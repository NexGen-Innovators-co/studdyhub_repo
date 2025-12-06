// components/SEOAppWrapper.tsx
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import DynamicHead from './seo/DynamicHead';
import App from '@/App';

export const SEOAppWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <HelmetProvider>
            <DynamicHead />
            {children}
        </HelmetProvider>
    );
};

// Then wrap your app in App.tsx
<SEOAppWrapper>
    <App />
</SEOAppWrapper>