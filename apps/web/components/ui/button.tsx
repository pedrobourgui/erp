import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/25",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-accent/30",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:border hover:border-input",
        ghost:
          "hover:bg-accent/10 hover:text-accent-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        success:
          "bg-success text-success-foreground shadow-sm shadow-success/20 hover:bg-success/90 hover:shadow-md hover:shadow-success/25",
        warning:
          "bg-warning text-warning-foreground shadow-sm shadow-warning/20 hover:bg-warning/90 hover:shadow-md hover:shadow-warning/25",
        cancel:
          "border border-input bg-background shadow-sm  hover:text-destructive hover:border-destructive"
      },

      action: {
        default: "",
        delete: "",
        success: "",
      },

      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-[13px]",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      action: "default",
      size: "default",
    },
    
    compoundVariants: [
      {
        variant: "ghost",
        action: "default",
        class: "hover:bg-primary hover:text-primary-foreground"
      },
      {
        variant: "ghost",
        action: "delete",
        class: "hover:bg-destructive hover:text-white text-destructive"

      },
      {
        variant: "ghost",
        action: "success",
        class: "hover:bg-accent hover:text-white text-destructive"
      }
    ]
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, action, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, action, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
