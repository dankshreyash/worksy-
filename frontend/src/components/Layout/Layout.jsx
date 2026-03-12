import { Outlet } from 'react-router-dom';
import { HiOutlineSun, HiOutlineMoon, HiOutlineLightningBolt } from 'react-icons/hi';
import { useApp } from '../../context/AppContext';
import './Layout.css';

export default function Layout() {
    const { theme, toggleTheme } = useApp();

    return (
        <div className="layout">
            <header className="layout-header">
                <div className="header-logo">
                    <div className="header-logo-icon">
                        <HiOutlineLightningBolt />
                    </div>
                    <div className="header-logo-text">
                        <h1>Worksy</h1>
                        <span>Job Automation</span>
                    </div>
                </div>

                <div className="header-actions">
                    <button className="theme-toggle-btn" onClick={toggleTheme}>
                        <span className="theme-toggle-icon">
                            {theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}
                        </span>
                        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                </div>
            </header>
            
            <main className="layout-main">
                <div className="layout-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
