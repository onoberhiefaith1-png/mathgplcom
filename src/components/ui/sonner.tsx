import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !border-border !bg-card !text-sm !leading-5 !text-card-foreground !shadow-lg",
          title: "!text-sm !font-semibold !leading-5 !text-card-foreground",
          description: "!text-sm !font-normal !leading-5 !text-card-foreground",
          actionButton: "!bg-primary !text-sm !text-primary-foreground",
          cancelButton: "!bg-muted !text-sm !text-card-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
