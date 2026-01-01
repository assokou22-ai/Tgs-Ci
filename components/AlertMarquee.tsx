import React from 'react';

interface AlertMarqueeProps {
  message: string;
}

const AlertMarquee: React.FC<AlertMarqueeProps> = ({ message }) => {
  return (
    <div className="bg-yellow-500 text-black text-sm font-bold overflow-hidden whitespace-nowrap py-1">
      <div className="inline-block animate-marquee">
        <span className="mx-8">{message}</span>
        <span className="mx-8">{message}</span>
        <span className="mx-8">{message}</span>
        <span className="mx-8">{message}</span>
      </div>
       <div className="inline-block animate-marquee">
        <span className="mx-8">{message}</span>
        <span className="mx-8">{message}</span>
        <span className="mx-8">{message}</span>
        <span className="mx-8">{message}</span>
      </div>
    </div>
  );
};

export default AlertMarquee;