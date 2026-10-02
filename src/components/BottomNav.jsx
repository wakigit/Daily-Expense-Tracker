import NavIcon from './NavIcon';

/**
 * §5: Home, History, Add, Ask, Budget. Add is raised because logging an
 * expense is the one thing the app exists for; Settings moved to the header
 * gear to make room for Budget.
 */
const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'history', label: 'History' },
  { id: 'add', label: 'Add', raised: true },
  { id: 'ask', label: 'Ask' },
  { id: 'budget', label: 'Budget' },
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
