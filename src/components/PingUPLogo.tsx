import React from 'react';

const PingUPLogo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <img
    src="https://mma.prnewswire.com/media/342968/pingup_logo_vertical_Logo.jpg?p=publish&w=950"
    alt="PingUP Logo"
    className={className}
  />
);

export default PingUPLogo;
