import React, { forwardRef } from 'react';

export interface EditorContainerProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
}

export const EditorContainer = forwardRef<HTMLDivElement, EditorContainerProps>(
  ({ children, className = '', innerClassName = '', style, innerStyle }, ref) => {
    return (
      <div className={className} style={style}>
        <div ref={ref} className={innerClassName} style={innerStyle}>
          {children}
        </div>
      </div>
    );
  }
);
