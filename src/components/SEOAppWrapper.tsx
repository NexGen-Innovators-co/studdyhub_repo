// components/SEOAppWrapper.tsx
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import DynamicHead from './seo/DynamicHead';

export const SEOAppWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    
    return (
        <HelmetProvider>
            <DynamicHead pathname={location.pathname} />
            {children}
        </HelmetProvider>
    );
};

export default SEOAppWrapper;
