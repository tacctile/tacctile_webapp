/**
 * Stripe Payment Integration for Tacctile
 * Handles subscription management and license purchasing
 */

import Stripe from 'stripe';

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
}

export interface Subscription {
  id: string;
  status: string;
  currentPeriodEnd: number;
  currentPeriodStart: number;
  priceId: string;
  customerId: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
  popular?: boolean;
}

export class StripePaymentProcessor {
  private stripe: Stripe;
  
  // Pricing configuration
  public readonly PRICING_PLANS: PricingPlan[] = [
    {
      id: 'trial',
      name: 'Free Trial',
      price: 0,
      currency: 'usd',
      interval: 'month',
      features: [
        '3 investigations maximum',
        '50 evidence files',
        'Basic reporting',
        '14-day trial period',
      ],
      stripePriceId: '', // No Stripe price for trial
    },
    {
      id: 'basic',
      name: 'Basic Plan',
      price: 19,
      currency: 'usd',
      interval: 'month',
      features: [
        '25 investigations',
        '500 evidence files',
        'Cloud sync',
        'Basic plugins',
        'Email support',
      ],
      stripePriceId: 'price_basic_monthly', // Replace with actual Stripe price ID
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 49,
      currency: 'usd',
      interval: 'month',
      features: [
        '100 investigations',
        '2000 evidence files',
        'Advanced analytics',
        'Custom reports',
        'All plugins',
        'Priority support',
      ],
      stripePriceId: 'price_pro_monthly', // Replace with actual Stripe price ID
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 99,
      currency: 'usd',
      interval: 'month',
      features: [
        'Unlimited investigations',
        'Unlimited evidence files',
        'White-label options',
        'Custom integrations',
        'Dedicated support',
        'Team collaboration',
      ],
      stripePriceId: 'price_enterprise_monthly', // Replace with actual Stripe price ID
    },
  ];

  constructor(secretKey?: string) {
    if (!secretKey && !process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key is required');
    }

    this.stripe = new Stripe(secretKey || process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-06-20',
    });
  }

  /**
   * Create a payment intent for one-time license purchase
   */
  public async createPaymentIntent(
    planId: string,
    customerEmail: string,
    metadata?: Record<string, string>
  ): Promise<PaymentIntent> {
    const plan = this.PRICING_PLANS.find(p => p.id === planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    if (plan.price === 0) {
      throw new Error('Cannot create payment intent for free plan');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: plan.price * 100, // Stripe uses cents
        currency: plan.currency,
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: customerEmail,
        metadata: {
          plan_id: planId,
          plan_name: plan.name,
          customer_email: customerEmail,
          ...metadata,
        },
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Create a subscription for recurring billing
   */
  public async createSubscription(
    customerEmail: string,
    planId: string,
    paymentMethodId: string
  ): Promise<Subscription> {
    const plan = this.PRICING_PLANS.find(p => p.id === planId);
    if (!plan || !plan.stripePriceId) {
      throw new Error(`Invalid plan ID or missing Stripe price ID: ${planId}`);
    }

    try {
      // Create or retrieve customer
      const customer = await this.createOrRetrieveCustomer(customerEmail);

      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      // Set as default payment method
      await this.stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [
          {
            price: plan.stripePriceId,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          plan_id: planId,
          plan_name: plan.name,
        },
      });

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        currentPeriodStart: subscription.current_period_start,
        priceId: plan.stripePriceId,
        customerId: customer.id,
      };
    } catch (error) {
      throw new Error(`Failed to create subscription: ${error.message}`);
    }
  }

  /**
   * Cancel a subscription
   */
  public async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Get subscription details
   */
  public async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription) return null;

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        currentPeriodStart: subscription.current_period_start,
        priceId: subscription.items.data[0]?.price.id || '',
        customerId: subscription.customer as string,
      };
    } catch (error) {
      console.error('Failed to retrieve subscription:', error);
      return null;
    }
  }

  /**
   * Handle webhook events
   */
  public async handleWebhook(
    payload: string,
    signature: string,
    webhookSecret: string
  ): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
        
        case 'invoice.payment_succeeded':
          await this.handleInvoicePayment(event.data.object as Stripe.Invoice);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      throw new Error(`Webhook handling failed: ${error.message}`);
    }
  }

  /**
   * Get customer payment methods
   */
  public async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      throw new Error(`Failed to retrieve payment methods: ${error.message}`);
    }
  }

  /**
   * Create or retrieve customer
   */
  private async createOrRetrieveCustomer(email: string): Promise<Stripe.Customer> {
    try {
      // Try to find existing customer
      const existingCustomers = await this.stripe.customers.list({
        email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
      }

      // Create new customer
      return await this.stripe.customers.create({
        email,
        metadata: {
          source: 'tacctile-toolbox',
        },
      });
    } catch (error) {
      throw new Error(`Failed to create/retrieve customer: ${error.message}`);
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log('Payment succeeded:', paymentIntent.id);
    
    const planId = paymentIntent.metadata?.plan_id;
    const customerEmail = paymentIntent.metadata?.customer_email;
    
    if (planId && customerEmail) {
      // Generate and send license key
      // This would integrate with your license generation system
      console.log(`Generating license for ${customerEmail} with plan ${planId}`);
    }
  }

  /**
   * Handle payment failure
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    console.log('Payment failed:', paymentIntent.id);
    
    const customerEmail = paymentIntent.metadata?.customer_email;
    if (customerEmail) {
      // Send failure notification
      console.log(`Notifying ${customerEmail} of payment failure`);
    }
  }

  /**
   * Handle subscription changes
   */
  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    console.log('Subscription changed:', subscription.id, subscription.status);
    
    // Update license based on subscription status
    // This would integrate with your license management system
  }

  /**
   * Handle invoice payment
   */
  private async handleInvoicePayment(invoice: Stripe.Invoice): Promise<void> {
    console.log('Invoice payment:', invoice.id);
    
    if (invoice.subscription) {
      // Renew license for subscription
      console.log(`Renewing license for subscription ${invoice.subscription}`);
    }
  }
}

// Export configured instance
let stripeProcessor: StripePaymentProcessor | null = null;

export function getStripeProcessor(): StripePaymentProcessor {
  if (!stripeProcessor) {
    stripeProcessor = new StripePaymentProcessor();
  }
  return stripeProcessor;
}

export default StripePaymentProcessor;