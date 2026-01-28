import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

// Helper to get initial from a string (e.g. user name or email)
function getInitial(text?: string) {
  if (!text) return 'U';
  const match = text.match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : 'U';
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ src, ...props }, ref) => {
  // Block Google avatar URLs
  const isGoogleAvatar = typeof src === 'string' && src.includes('lh3.googleusercontent.com');
  if (!src || isGoogleAvatar) return null;
  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={src}
      referrerPolicy="no-referrer"
      className={cn("aspect-square h-full w-full", props.className)}
      {...props}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & { user?: string }
>(({ className, user, children, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted text-lg font-semibold",
      className
    )}
    {...props}
  >
    {children || getInitial(user)}
  </AvatarPrimitive.Fallback>
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback }
