import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const skeletonButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] bg-[length:200%_200%] animate-[btn-gradient_3s_ease_infinite]',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90',
        outline:
          'border-2 border-emerald-200 bg-white text-emerald-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-md active:scale-[0.98] transition-all duration-200',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground',
        link: 'text-emerald-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface SkeletonButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof skeletonButtonVariants> {
  loading?: boolean;
  children: React.ReactNode;
  loaderIcon?: React.ReactNode;
  loadingText?: string;
  skeletonWidth?: string;
  keepWidth?: boolean;
}

const SkeletonButton = React.forwardRef<HTMLButtonElement, SkeletonButtonProps>(
  ({
    className,
    variant,
    size,
    loading = false,
    children,
    loaderIcon,
    loadingText,
    skeletonWidth = '4rem',
    keepWidth = true,
    disabled,
    onClick,
    ...props
  }, ref) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [storedWidth, setStoredWidth] = React.useState<string | undefined>(undefined);

    React.useEffect(() => {
      if (keepWidth && buttonRef.current) {
        setStoredWidth(`${buttonRef.current.offsetWidth}px`);
      }
    }, [keepWidth]);

    const isDisabled = disabled || loading;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading) return;
      onClick?.(e);
    };

    return (
      <button
        ref={(node) => {
          (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        data-slot="skeleton-button"
        className={cn(
          skeletonButtonVariants({ variant, size, className }),
          keepWidth && storedWidth && 'w-[--btn-width]',
          'rounded-xl'
        )}
        style={
          keepWidth && storedWidth
            ? ({ '--btn-width': storedWidth } as React.CSSProperties)
            : undefined
        }
        disabled={isDisabled}
        onClick={handleClick}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <span className="inline-flex items-center justify-center" aria-hidden="true">
              {loaderIcon || (
                <svg
                  className="animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </span>
            {loadingText ? (
              <span>{loadingText}</span>
            ) : (
              <span
                className="relative overflow-hidden rounded-sm bg-white/25"
                style={{ width: skeletonWidth, height: '0.75em', display: 'inline-block' }}
                aria-hidden="true"
              >
                <span
                  className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite]"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                  }}
                />
              </span>
            )}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

SkeletonButton.displayName = 'SkeletonButton';

export { SkeletonButton, skeletonButtonVariants };
