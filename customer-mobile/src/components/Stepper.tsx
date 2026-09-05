import { useLocale, t } from '@rafidain/shared';

export function Stepper({ quantity, onChange, max = 99 }: { quantity: number; onChange: (n: number) => void; max?: number }) {
  useLocale();
  const dec = () => onChange(quantity - 1);
  const inc = () => onChange(max && quantity >= max ? quantity : quantity + 1);
  return (
    <div className="stepper">
      <button onClick={dec} type="button" aria-label={t('stepper.decrease')}>−</button>
      <span>{quantity}</span>
      <button onClick={inc} type="button" aria-label={t('stepper.increase')}>+</button>
    </div>
  );
}
