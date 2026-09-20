/**
 * System alert.
 *
 * The desktop has icons for Photoshop, After Effects, Blender and VS Code.
 * They do not launch anything — clicking one opens this, a small, well-made
 * dialog with a line written for that app. It is a joke about a portfolio that
 * dresses up as an operating system, and it works precisely because the dialog
 * itself is built properly rather than as a gag.
 *
 * Every word comes from `alerts[]` in the content file. Buttons do one thing:
 * close the window. There is nothing behind them and there should not be.
 */
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react';
import { useOs } from '@/state/os';
import { usePortfolio } from '@/state/portfolio';
import { Btn } from '@/components/ui/Ui';
import type { AppProps } from '../registry';
import './apps.css';

const ICONS = {
  info: Info,
  caution: AlertTriangle,
  error: OctagonAlert,
} as const;

export function AlertApp({ win }: AppProps) {
  const { alerts } = usePortfolio();
  const closeWindow = useOs((state) => state.closeWindow);

  const alert = alerts.find((entry) => entry.id === win.payload.alertId);
  if (!alert) return null;

  const Icon = ICONS[alert.tone];
  const buttons = alert.buttons.length > 0 ? alert.buttons : [{ label: 'OK', primary: true }];

  return (
    <div className="alert" data-tone={alert.tone}>
      <span className="alert__icon">
        <Icon strokeWidth={1.6} />
      </span>

      <h1 className="alert__title">{alert.title}</h1>
      <p className="alert__body">{alert.body}</p>

      <div className="alert__actions">
        {buttons.map((button) => (
          <Btn
            key={button.label}
            size="sm"
            variant={button.primary ? 'primary' : 'outline'}
            onClick={() => closeWindow(win.id)}
          >
            {button.label}
          </Btn>
        ))}
      </div>
    </div>
  );
}
