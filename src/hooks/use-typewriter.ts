
import { useState, useEffect } from 'react';

type TypewriterOptions = {
  onUpdate?: () => void;
};

export const useTypewriter = (text: string, speed: number = 50, options: TypewriterOptions = {}) => {
  const [displayedText, setDisplayedText] = useState('');
  const { onUpdate } = options;

  useEffect(() => {
    setDisplayedText(''); // Reset on text change
    if (text) {
        let i = 0;
        const typingInterval = setInterval(() => {
            if (i < text.length) {
                setDisplayedText(prev => prev + text.charAt(i));
                i++;
                onUpdate?.(); // Call the callback on each update
            } else {
                clearInterval(typingInterval);
            }
        }, speed);

        return () => {
            clearInterval(typingInterval);
        };
    }
  }, [text, speed, onUpdate]);

  return displayedText;
};
