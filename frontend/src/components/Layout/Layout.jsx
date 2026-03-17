import { Outlet } from 'react-router-dom';
import { HiOutlineSun, HiOutlineMoon, HiOutlineLightningBolt, HiSparkles } from 'react-icons/hi';
import { useApp } from '../../context/AppContext';
import './Layout.css';

export default function Layout() {
    const { theme, toggleTheme, proMode, toggleProMode } = useApp();

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
                    <button 
                        className={`pro-toggle-btn ${proMode ? 'active' : ''}`} 
                        onClick={toggleProMode}
                        title="Pro Mode: Auto-parse resume keywords"
                    >
                        <HiSparkles className="pro-icon" />
                        <span>PRO</span>
                    </button>
                </div>
            </header>
            
            <main className="layout-main">
                <div className="layout-content">
                    <Outlet />
                </div>
            </main>

            <button className="theme-toggle-btn fixed-theme-toggle" onClick={toggleTheme} title="Toggle Theme">
                <span className="theme-toggle-icon">
                    {theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}
                </span>
            </button>
        </div>
    );
}
