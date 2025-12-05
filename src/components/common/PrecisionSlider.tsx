import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Slider, IconButton, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const Row = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  height: 28,
  gap: 4,
});

const Label = styled(Typography)({
  fontSize: 11,
  color: '#888',
  minWidth: 70,
  flexShrink: 0,
});

const StepButton = styled(IconButton)({
  padding: 2,
  color: '#666',
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
  '&:disabled': {
    color: '#333',
  },
});

const ValueDisplay = styled(Box)({
  minWidth: 40,
  textAlign: 'right',
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: 2,
  '&:hover': {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

const ValueInput = styled(TextField)({
  width: 50,
  '& .MuiInputBase-root': {
    height: 22,
    fontSize: 11,
    color: '#ccc',
    backgroundColor: '#252525',
  },
  '& .MuiInputBase-input': {
    padding: '2px 4px',
    textAlign: 'right',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#19abb5',
  },
});

interface PrecisionSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export const PrecisionSlider: React.FC<PrecisionSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  disabled = false,
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(value));
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const clamp = (val: number) => Math.min(max, Math.max(min, val));

  const handleIncrement = () => {
    onChange(clamp(value + step));
  };

  const handleDecrement = () => {
    onChange(clamp(value - step));
  };

  const startHold = (action: () => void) => {
    action();
    holdIntervalRef.current = setInterval(action, 100);
  };

  const stopHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handleValueClick = () => {
    if (!disabled) {
      setIsEditing(true);
    }
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(String(value));
    }
  };

  const displayValue = Number.isInteger(step) ? value : value.toFixed(1);

  return (
    <Row>
      <Label>{label}</Label>

      <StepButton
        size="small"
        onMouseDown={() => startHold(handleDecrement)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        disabled={disabled || value <= min}
      >
        <RemoveIcon sx={{ fontSize: 14 }} />
      </StepButton>

      <Slider
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_, v) => onChange(v as number)}
        disabled={disabled}
        sx={{
          flex: 1,
          color: '#19abb5',
          height: 4,
          '& .MuiSlider-thumb': {
            width: 12,
            height: 12,
          },
          '& .MuiSlider-rail': {
            backgroundColor: '#333',
          },
        }}
      />

      <StepButton
        size="small"
        onMouseDown={() => startHold(handleIncrement)}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        disabled={disabled || value >= max}
      >
        <AddIcon sx={{ fontSize: 14 }} />
      </StepButton>

      {isEditing ? (
        <ValueInput
          inputRef={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          size="small"
          variant="outlined"
        />
      ) : (
        <ValueDisplay onClick={handleValueClick}>
          <Typography sx={{ fontSize: 11, color: disabled ? '#444' : '#ccc' }}>
            {displayValue}{unit}
          </Typography>
        </ValueDisplay>
      )}
    </Row>
  );
};

export default PrecisionSlider;
