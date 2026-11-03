import { Logo } from './Logo';

/** The signature of the login and welcome screens: a quiet radar sweep around the Magmafy mark. Pure CSS, frozen with reduced motion. */
export function Radar({ size = 220, logo = 72, children }: { size?: number; logo?: number; children?: React.ReactNode }) {
  return (
    <div className="radar" style={{ width: size, height: size }} aria-hidden="true">
      <span className="radar__ring" /><span className="radar__ring radar__ring--2" /><span className="radar__ring radar__ring--3" />
      <span className="radar__sweep" />
      <i className="radar__blip" style={{ top: '22%', insetInlineStart: '68%' }} /><i className="radar__blip" style={{ top: '64%', insetInlineStart: '24%', animationDelay: '1.3s' }} /><i className="radar__blip" style={{ top: '76%', insetInlineStart: '70%', animationDelay: '2.4s' }} />
      <span className="radar__core">{children || <Logo size={logo} />}</span>
    </div>
  );
}
