type Props = {
  message: string;
  variant?: "trial" | "limit" | "billing";
};

export default function SubscriptionBanner({ message, variant = "trial" }: Props) {
  const styles =
    variant === "limit"
      ? "border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 text-orange-900 dark:text-orange-200"
      : variant === "billing"
        ? "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-red-900 dark:text-red-200"
        : "border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800 text-sky-900 dark:text-sky-200";

  return (
    <div className={`mb-6 p-4 rounded-lg border flex items-start gap-2 ${styles}`}>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
