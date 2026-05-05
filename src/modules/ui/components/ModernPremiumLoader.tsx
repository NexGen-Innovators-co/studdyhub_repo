import React from 'react';
import { motion } from 'framer-motion';

interface ModernPremiumLoaderProps {
    text?: string;
    className?: string;
    fullScreen?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const ModernPremiumLoader: React.FC<ModernPremiumLoaderProps> = ({
    text = "STUDDYHUB",
    className = "",
    fullScreen = true,
    size = 'lg'
}) => {
    const containerClasses = fullScreen
        ? "fixed inset-0 z-[100] min-h-screen w-full bg-slate-50 dark:bg-[#030712]"
        : "relative w-full py-12 bg-transparent";

    const sizeScales = {
        sm: "scale-50",
        md: "scale-75",
        lg: "scale-100"
    };

    return (
        <div className={`${containerClasses} flex flex-col items-center justify-center overflow-hidden ${className}`}>
            {fullScreen && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            x: [0, 50, 0],
                            y: [0, 30, 0],
                        }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-[100px]"
                    />
                    <motion.div
                        animate={{
                            scale: [1, 1.5, 1],
                            x: [0, -70, 0],
                            y: [0, -40, 0],
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 dark:bg-purple-500/20 blur-[120px]"
                    />
                </div>
            )}

            <div className={`relative flex flex-col items-center z-10 ${sizeScales[size]}`}>
                {/* Main Morphing Loader */}
                <div className="relative w-32 h-32 md:w-40 md:h-40 mb-8 flex items-center justify-center">
                    {/* Animated Neon Rings */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500/50 border-r-purple-500/30 dark:border-t-indigo-400 dark:border-r-purple-400/50"
                    />
                    <motion.div
                        animate={{ rotate: -360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-2 rounded-full border border-transparent border-b-blue-500/40 border-l-indigo-500/20 dark:border-b-blue-400/40 dark:border-l-indigo-400/20"
                    />

                    {/* Morphing Glass Core */}
                    <motion.div
                        animate={{
                            borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 70%", "30% 60% 70% 40% / 50% 60% 30% 60%", "40% 60% 70% 30% / 40% 50% 60% 70%"],
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="w-20 h-20 md:w-24 md:h-24 bg-white/20 dark:bg-white/5 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-2xl flex items-center justify-center relative overflow-hidden"
                    >
                        {/* Inner Glow */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-transparent to-purple-500/20 animate-pulse" />

                        {/* StuddyHub Logo Mark (Simple 'S' or Book Icon substitute) */}
                        <div className="relative z-10">
                            <motion.div
                                animate={{ rotateY: [0, 180, 360] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <div className="w-8 h-12 border-4 border-indigo-600 dark:border-indigo-400 rounded-sm relative transform -skew-x-12">
                                    <div className="absolute top-1/4 left-0 w-full h-1 bg-indigo-600/50 dark:bg-indigo-400/50" />
                                    <div className="absolute top-2/4 left-0 w-full h-1 bg-indigo-600/50 dark:bg-indigo-400/50" />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Orbiting Particles */}
                    {[...Array(3)].map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                rotate: 360,
                                scale: [1, 1.2, 1],
                            }}
                            transition={{
                                rotate: { duration: 3 + i, repeat: Infinity, ease: "linear" },
                                scale: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }
                            }}
                            className="absolute inset-0"
                        >
                            <div
                                className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 absolute shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                style={{
                                    top: '-4px',
                                    left: '50%',
                                    marginLeft: '-4px',
                                    transform: `scale(${0.8 + (i * 0.2)})`
                                }}
                            />
                        </motion.div>
                    ))}
                </div>

                {/* Branding Text */}
                <div className="text-center">
                    <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-2xl md:text-3xl font-bold tracking-[0.2em] text-slate-800 dark:text-white mb-2"
                    >
                        {text.split('').map((char, i) => (char === ' ' ? <span key={i}>&nbsp;</span> : (
                            <motion.span
                                key={i}
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                            >
                                {char}
                            </motion.span>
                        )))}
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-xs md:text-sm font-medium tracking-[0.4em] text-indigo-500 dark:text-indigo-400 uppercase"
                    >
                        Empowering Your Learning
                    </motion.p>
                </div>

                {/* Loading Progress Bar Indicator (Subtle) */}
                <div className="mt-12 w-48 h-1 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden relative">
                    <motion.div
                        animate={{
                            x: [-192, 192],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                    />
                </div>
            </div>

            {/* Visual Enhancements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.02)_100%)] dark:bg-none pointer-events-none" />
        </div>
    );
};

export default ModernPremiumLoader;
