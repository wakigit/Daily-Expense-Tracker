import NavIcon from './NavIcon';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'history', label: 'History' },
  { id: 'add', label: 'Add' },
  { id: 'ask', label: 'Ask' },
  { id: 'settings', label: 'Settings' },
];

export default function BottomNav({ tab, onGo }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((item) => (
        <button
          key={item.id}
          className={`nav-btn${tab === item.id ? ' active' : ''}`}
          onClick={() => onGo(item.id)}
          aria-current={tab === item.id ? 'page' : undefined}
        >
          <NavIcon id={item.id} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
