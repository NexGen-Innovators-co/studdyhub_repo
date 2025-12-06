// components/layout/SeoLayout.tsx
import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import DynamicHead from '../seo/DynamicHead';

interface SeoLayoutProps {
    children: React.ReactNode;
    pathname: string;
}

export const SeoLayout: React.FC<SeoLayoutProps> = ({ children, pathname }) => {
    return (
        <HelmetProvider>
            <DynamicHead pathname={pathname} />
            {children}
        </HelmetProvider>
    );
};