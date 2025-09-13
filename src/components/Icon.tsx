import React from 'react';
import { SvgIconProps } from '@mui/icons-material';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type IconColor = 'default' | 'primary' | 'secondary' | 'tertiary' | 'error' | 'warning' | 'success' | 'info' | 'muted' |
  'emf' | 'temperature' | 'audio' | 'visual' | 'motion' | 'anomaly';
export type IconVariant = 'filled' | 'outlined' | 'rounded' | 'sharp' | 'two-tone';

interface IconProps extends Omit<SvgIconProps, 'color' | 'fontSize'> {
  icon: React.ComponentType<SvgIconProps>;
  size?: IconSize;
  color?: IconColor;
  variant?: IconVariant;
  spin?: boolean;
  pulse?: boolean;
  bounce?: boolean;
  ping?: boolean;
  badge?: string | number | boolean;
  className?: string;
}

/**
 * Material Icon Wrapper Component
 * Provides consistent icon styling with Material 3 design system
 */
export const Icon: React.FC<IconProps> = ({
  icon: IconComponent,
  size = 'md',
  color = 'default',
  spin = false,
  pulse = false,
  bounce = false,
  ping = false,
  badge,
  className = '',
  ...props
}) => {
  const classes = [
    'icon',
    `icon-${size}`,
    color !== 'default' && `icon-${color}`,
    spin && 'icon-spin',
    pulse && 'icon-pulse',
    bounce && 'icon-bounce',
    ping && 'icon-ping',
    badge !== undefined && 'icon-badge',
    badge === true && 'badge-dot',
    className
  ].filter(Boolean).join(' ');

  const iconProps = {
    ...props,
    className: classes,
    ...(badge && typeof badge !== 'boolean' && { 'data-badge': badge })
  };

  return <IconComponent {...iconProps} />;
};

/**
 * Icon Button Component
 * Material 3 styled icon button
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<SvgIconProps>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  iconSize?: IconSize;
  iconColor?: IconColor;
  badge?: string | number | boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: IconComponent,
  size = 'md',
  variant = 'standard',
  iconSize = 'md',
  iconColor = 'default',
  badge,
  className = '',
  children,
  ...props
}) => {
  const buttonClasses = [
    'icon-button',
    size !== 'md' && `icon-button-${size}`,
    variant !== 'standard' && `icon-button-${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button className={buttonClasses} {...props}>
      <Icon 
        icon={IconComponent} 
        size={iconSize} 
        color={iconColor}
        badge={badge}
      />
      {children}
    </button>
  );
};

/**
 * Icon With Text Component
 * Combines icon with text label
 */
interface IconWithTextProps {
  icon: React.ComponentType<SvgIconProps>;
  text: string;
  iconSize?: IconSize;
  iconColor?: IconColor;
  vertical?: boolean;
  className?: string;
}

export const IconWithText: React.FC<IconWithTextProps> = ({
  icon: IconComponent,
  text,
  iconSize = 'md',
  iconColor = 'default',
  vertical = false,
  className = ''
}) => {
  const classes = [
    vertical ? 'icon-with-text-vertical' : 'icon-with-text',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <Icon icon={IconComponent} size={iconSize} color={iconColor} />
      <span>{text}</span>
    </div>
  );
};

/**
 * Icon Group Component
 * Groups multiple icons together
 */
interface IconGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const IconGroup: React.FC<IconGroupProps> = ({ children, className = '' }) => {
  return (
    <div className={`icon-group ${className}`}>
      {children}
    </div>
  );
};

/**
 * Icon Stack Component
 * Stacks icons on top of each other
 */
interface IconStackProps {
  primary: React.ComponentType<SvgIconProps>;
  secondary?: React.ComponentType<SvgIconProps>;
  primarySize?: IconSize;
  secondarySize?: IconSize;
  primaryColor?: IconColor;
  secondaryColor?: IconColor;
  className?: string;
}

export const IconStack: React.FC<IconStackProps> = ({
  primary: PrimaryIcon,
  secondary: SecondaryIcon,
  primarySize = 'md',
  secondarySize = 'sm',
  primaryColor = 'default',
  secondaryColor = 'default',
  className = ''
}) => {
  return (
    <div className={`icon-stack ${className}`}>
      <Icon icon={PrimaryIcon} size={primarySize} color={primaryColor} />
      {SecondaryIcon && (
        <Icon icon={SecondaryIcon} size={secondarySize} color={secondaryColor} />
      )}
    </div>
  );
};

export default Icon;