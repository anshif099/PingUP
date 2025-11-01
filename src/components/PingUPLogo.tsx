import React from 'react';

const PingUPLogo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <img
    src="/PingUP.jpg"
    alt="PingUP Logo"
    className={className}
  />
);

export default PingUPLogo;
