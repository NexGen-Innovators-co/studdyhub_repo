// src/components/layout/ScreenshotGallery.tsx
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Sun, Moon } from 'lucide-react';

interface Screenshot {
    id: number;
    title: string;
    description: string;
    darkUrl: string;    // Dark mode screenshot
    lightUrl: string;   // Light mode screenshot
    category: string;
}

interface ScreenshotGalleryProps {
    screenshots: Screenshot[];
    title?: string;
    description?: string;
    showThemeToggle?: boolean;
}

export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({
    screenshots,
    title = "App Interface",
    description = "Explore our intuitive and powerful user interface",
    showThemeToggle = true
}) => {
    const [selectedImage, setSelectedImage] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Detect system theme on component mount
    useEffect(() => {
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('theme');

        if (savedTheme === 'dark' || (!savedTheme && isSystemDark)) {
            setIsDarkMode(true);
        }
    }, []);

    // Listen for theme changes
    useEffect(() => {
        const handleThemeChange = (e: MediaQueryListEvent) => {
            const savedTheme = localStorage.getItem('theme');
            if (!savedTheme) {
                setIsDarkMode(e.matches);
            }
        };

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', handleThemeChange);

        return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }, []);

    // Also check if theme changes via our app
    useEffect(() => {
        const checkTheme = () => {
            const isDark = document.documentElement.classList.contains('dark');
            setIsDarkMode(isDark);
        };

        // Check initially
        checkTheme();

        // Create observer to watch for theme class changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    checkTheme();
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    const categories = ['All', ...new Set(screenshots.map(s => s.category))];

    const filteredScreenshots = selectedCategory === 'All'
        ? screenshots
        : screenshots.filter(s => s.category === selectedCategory);

    const getCurrentImageUrl = (screenshot: Screenshot) => {
        return isDarkMode ? screenshot.darkUrl : screenshot.lightUrl;
    };

    const openLightbox = (index: number) => {
        setSelectedImage(index);
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        setSelectedImage(null);
        document.body.style.overflow = 'auto';
    };

    const nextImage = () => {
        if (selectedImage !== null) {
            setSelectedImage((selectedImage + 1) % filteredScreenshots.length);
        }
    };

    const prevImage = () => {
        if (selectedImage !== null) {
            setSelectedImage((selectedImage - 1 + filteredScreenshots.length) % filteredScreenshots.length);
        }
    };

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    return (
        <div className="py-8">
            {title && (
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
                    {description && (
                        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{description}</p>
                    )}
                </div>
            )}

            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg transition-all text-sm ${selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-600 dark:bg-gray-700 text-white dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* Theme Toggle */}
                {showThemeToggle && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            View in:
                        </span>
                        <button
                            onClick={toggleTheme}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            {isDarkMode ? (
                                <>
                                    <Moon className="h-4 w-4 text-blue-600" />
                                    <span className="text-gray-700 dark:text-gray-300">Dark Mode</span>
                                </>
                            ) : (
                                <>
                                    <Sun className="h-4 w-4 text-yellow-600" />
                                    <span className="text-gray-700 dark:text-gray-300">Light Mode</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Theme Indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${isDarkMode
                    ? 'bg-blue-900/20 text-blue-400 border border-blue-800'
                    : 'bg-blue-100 text-blue-600 border border-blue-200'
                    }`}>
                    {isDarkMode ? (
                        <>
                            <Moon className="h-4 w-4" />
                            <span className="text-sm font-medium">Showing Dark Mode Screenshots</span>
                        </>
                    ) : (
                        <>
                            <Sun className="h-4 w-4" />
                            <span className="text-sm font-medium">Showing Light Mode Screenshots</span>
                        </>
                    )}
                </div>
            </div>

            {/* Screenshot Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredScreenshots.map((screenshot, index) => (
                    <div
                        key={screenshot.id}
                        className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer"
                        onClick={() => openLightbox(index)}
                    >
                        <div className="relative overflow-hidden">
                            <img
                                src={getCurrentImageUrl(screenshot)}
                                alt={screenshot.title}
                                className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-500"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                                <div className="flex items-center gap-2 text-white">
                                    <Maximize2 className="h-4 w-4" />
                                    <span className="text-sm font-medium">View Details</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-gray-900 dark:text-white">{screenshot.title}</h3>
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded-md">
                                    {screenshot.category}
                                </span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                {screenshot.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Lightbox Modal */}
            {selectedImage !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
                    <button
                        onClick={closeLightbox}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
                    >
                        <X className="h-8 w-8" />
                    </button>

                    <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
                    >
                        <ChevronLeft className="h-8 w-8" />
                    </button>

                    <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
                    >
                        <ChevronRight className="h-8 w-8" />
                    </button>

                    {/* Theme Toggle in Lightbox */}
                    <div className="absolute top-4 left-4 z-10">
                        <button
                            onClick={toggleTheme}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-800/80 hover:bg-gray-700/80 backdrop-blur-sm rounded-lg text-white transition-colors"
                        >
                            {isDarkMode ? (
                                <>
                                    <Sun className="h-4 w-4" />
                                    <span className="text-sm">Switch to Light</span>
                                </>
                            ) : (
                                <>
                                    <Moon className="h-4 w-4" />
                                    <span className="text-sm">Switch to Dark</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <img
                            src={getCurrentImageUrl(filteredScreenshots[selectedImage])}
                            alt={filteredScreenshots[selectedImage].title}
                            className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                        />

                        <div className="mt-4 text-white text-center">
                            <h3 className="text-xl font-bold mb-2">{filteredScreenshots[selectedImage].title}</h3>
                            <p className="text-gray-300">{filteredScreenshots[selectedImage].description}</p>
                            <div className="flex items-center justify-center gap-2 mt-3">
                                <span className="px-3 py-1 bg-blue-600/80 rounded-full text-sm">
                                    {filteredScreenshots[selectedImage].category}
                                </span>
                                <span className="px-3 py-1 bg-purple-600/80 rounded-full text-sm flex items-center gap-1">
                                    {isDarkMode ? (
                                        <>
                                            <Moon className="h-3 w-3" /> Dark Mode
                                        </>
                                    ) : (
                                        <>
                                            <Sun className="h-3 w-3" /> Light Mode
                                        </>
                                    )}
                                </span>
                            </div>
                            <p className="text-sm text-gray-400 mt-4">
                                {selectedImage + 1} of {filteredScreenshots.length}
                            </p>
                        </div>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {filteredScreenshots.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setSelectedImage(index)}
                                className={`w-2 h-2 rounded-full transition-all ${index === selectedImage ? 'bg-white w-4' : 'bg-gray-500'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};