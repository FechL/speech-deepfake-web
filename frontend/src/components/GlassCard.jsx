import React from 'react';

const GlassCard = ({
  children,
  className = '',
  blur = 15,
  borderColor = 'var(--border)',
  padding = '24px',
  style = {},
  onClick,
  ...props
}) => {
  const cardStyle = {
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    background: `var(--card-bg)`,
    borderColor: borderColor,
    padding: padding,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '20px',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    ...style,
  };

  return (
    <div
      className={`glass-card ${className}`}
      style={cardStyle}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassCard;
