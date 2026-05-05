import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Maximize2, Sun, Moon, Filter } from 'lucide-react';

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

        checkTheme();

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

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (selectedImage !== null) {
            let nextIndex = selectedImage + 1;
            // Find the index in the original array that corresponds to the next item in the filtered array
            // Optimization: Just cycle through filtered array and map back to execution is complex?
            // Simpler: Just work with indices of filteredScreenshots if we show filtered only in lightbox.
            // But we might want to navigate ALL screenshots? Usually lightbox respects the filter context.
            // Let's stick to filteredScreenshots for navigation logic.
            if (nextIndex >= filteredScreenshots.length) nextIndex = 0;
            setSelectedImage(nextIndex);
        }
    };

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (selectedImage !== null) {
            let prevIndex = selectedImage - 1;
            if (prevIndex < 0) prevIndex = filteredScreenshots.length - 1;
            setSelectedImage(prevIndex);
        }
    };

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedImage === null) return;
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'Escape') closeLightbox();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImage, filteredScreenshots]);

    return (
        <div className="py-12 bg-gray-50/50 dark:bg-gray-900/50 rounded-3xl my-8">
            <div className="container mx-auto px-4">
                {title && (
                    <div className="text-center mb-12 space-y-4">
                        <motion.h2 
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400"
                        >
                            {title}
                        </motion.h2>
                        {description && (
                            <motion.p 
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 }}
                                className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
                            >
                                {description}
                            </motion.p>
                        )}
                    </div>
                )}

                {/* Controls Bar */}
                <div className="sticky top-4 z-30 mb-10 w-full max-w-4xl mx-auto backdrop-blur-md bg-white/80 dark:bg-gray-900/80 p-2 rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        {/* Category Filter */}
                        <div className="flex flex-wrap justify-center gap-1 w-full sm:w-auto">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                                        selectedCategory === category
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>

                        {/* Theme Toggle */}
                        {showThemeToggle && (
                            <button
                                onClick={toggleTheme}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group w-full sm:w-auto justify-center"
                            >
                                {isDarkMode ? (
                                    <>
                                        <Moon className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</span>
                                    </>
                                ) : (
                                    <>
                                        <Sun className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Light Mode</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Mobile Carousel (Visible on mobile, hidden on sm+) */}
                <div className="md:hidden overflow-x-auto pb-6 -mx-4 px-4 flex snap-x snap-mandatory gap-4 no-scrollbar">
                    {filteredScreenshots.map((screenshot, index) => (
                         <div 
                            key={screenshot.id}
                            className="snap-center shrink-0 w-[85vw] first:pl-2 last:pr-2"
                            onClick={() => openLightbox(index)}
                         >
                            <div className="relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg h-full border border-gray-100 dark:border-gray-800">
                                <motion.img
                                    layoutId={`img-${screenshot.id}-mobile`} 
                                    src={getCurrentImageUrl(screenshot)}
                                    alt={screenshot.title}
                                    className="w-full h-48 object-cover"
                                    loading="lazy"
                                />
                                <div className="p-4">
                                     <p className="text-blue-500 text-xs font-bold uppercase mb-1">{screenshot.category}</p>
                                     <h3 className="text-gray-900 dark:text-white font-bold text-lg leading-tight mb-2">{screenshot.title}</h3>
                                     <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">{screenshot.description}</p>
                                </div>
                            </div>
                         </div>
                    ))}
                </div>

                {/* Desktop Masonry Grid (Hidden on mobile, visible on sm+) */}
                <motion.div 
                    layout
                    className="hidden md:block columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6"
                >
                    <AnimatePresence mode='popLayout'>
                        {filteredScreenshots.map((screenshot, index) => (
                            <motion.div
                                layout
                                key={screenshot.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.3 }}
                                className="break-inside-avoid group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-100 dark:border-gray-800"
                                onClick={() => openLightbox(index)}
                            >
                                <div className="relative overflow-hidden aspect-auto">
                                    <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" /> {/* Placeholder */}
                                    <motion.img
                                        layoutId={`img-${screenshot.id}`}
                                        src={getCurrentImageUrl(screenshot)}
                                        alt={screenshot.title}
                                        className="relative w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700 will-change-transform"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                        <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                            <p className="text-blue-400 text-xs font-bold tracking-wider uppercase mb-1">{screenshot.category}</p>
                                            <h3 className="text-white font-bold text-lg leading-tight">{screenshot.title}</h3>
                                            <div className="flex items-center gap-2 text-gray-300 text-sm mt-2 opacity-0 group-hover:opacity-100 transition-opacity delay-100">
                                                <Maximize2 className="h-4 w-4" />
                                                <span>Click to expand</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>

                {/* Lightbox Modal */}
                {typeof document !== 'undefined' && createPortal(
                    <AnimatePresence>
                        {selectedImage !== null && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
                                onClick={closeLightbox}
                            >
                                {/* Controls */}
                                <button
                                    onClick={closeLightbox}
                                    className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50"
                                >
                                    <X className="h-6 w-6" />
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); prevImage(e); }}
                                    className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110 z-50 hidden md:block"
                                >
                                    <ChevronLeft className="h-8 w-8" />
                                </button>

                                <button
                                    onClick={(e) => { e.stopPropagation(); nextImage(e); }}
                                    className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110 z-50 hidden md:block"
                                >
                                    <ChevronRight className="h-8 w-8" />
                                </button>

                                {/* Theme Toggle in Lightbox */}
                                <div className="absolute top-6 left-6 z-50">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleTheme(); }}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors ring-1 ring-white/20"
                                    >
                                        {isDarkMode ? (
                                            <>
                                                <Sun className="h-4 w-4" />
                                                <span className="text-sm">Light Mode</span>
                                            </>
                                        ) : (
                                            <>
                                                <Moon className="h-4 w-4" />
                                                <span className="text-sm">Dark Mode</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div
                                    className="relative max-w-7xl w-full max-h-[90vh] flex flex-col items-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="relative w-full flex justify-center items-center bg-transparent overflow-visible">
                                        <motion.img
                                            layoutId={window.innerWidth >= 768 ? `img-${filteredScreenshots[selectedImage].id}` : `img-${filteredScreenshots[selectedImage].id}-mobile`}
                                            key={filteredScreenshots[selectedImage].id}
                                            src={getCurrentImageUrl(filteredScreenshots[selectedImage])}
                                            alt={filteredScreenshots[selectedImage].title}
                                            className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl cursor-grab active:cursor-grabbing"
                                            drag="y"
                                            dragConstraints={{ top: 0, bottom: 0 }}
                                            dragElastic={0.2}
                                            onDragEnd={(e, { offset, velocity }) => {
                                                if (Math.abs(offset.y) > 100 || Math.abs(velocity.y) > 500) {
                                                    closeLightbox();
                                                }
                                            }}
                                        />
                                    </div>
                                    
                                    <motion.div 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="mt-6 text-center max-w-2xl mx-auto"
                                    >
                                        <h3 className="text-2xl font-bold text-white mb-2">{filteredScreenshots[selectedImage].title}</h3>
                                        <p className="text-gray-300 text-lg leading-relaxed">{filteredScreenshots[selectedImage].description}</p>
                                        
                                        <div className="flex items-center justify-center gap-2 mt-4">
                                            {filteredScreenshots.map((_, index) => (
                                                <button
                                                    key={index}
                                                    onClick={(e) => { e.stopPropagation(); setSelectedImage(index); }}
                                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                                        index === selectedImage ? 'bg-white w-8' : 'bg-white/30 w-1.5 hover:bg-white/50'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
            </div>
        </div>
    );
};