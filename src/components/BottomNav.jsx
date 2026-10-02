import NavIcon from './NavIcon';

/**
 * Home, Overview, Add, Ask, Settings. Add is raised because logging an expense
 * is the one thing the app exists for.
 *
 * Budget had this last slot briefly; it showed figures Home already showed, so
 * the slot went to Settings and the header gear went with it.
 */
const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'overview', label: 'Overview' },
  { id: 'add', label: 'Add', raised: true },
  { id: 'ask', label: 'Ask' },
  { id: 'settings', label: 'Settings' },
];

export default function BottomNav({ tab, onGo }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((item) => (
        <button
          key={item.id}
          className={`nav-btn${tab === item.id ? ' active' : ''}${item.raised ? ' raised' : ''}`}
          onClick={() => onGo(item.id)}
          aria-current={tab === item.id ? 'page' : undefined}
        >
          <span className="nav-ico">
            <NavIcon id={item.id} />
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
