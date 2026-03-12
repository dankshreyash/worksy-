import { useState, useEffect, useRef } from 'react';
import {
    HiOutlineSearch,
    HiOutlineAdjustments,
    HiOutlineLocationMarker,
    HiOutlineCurrencyRupee,
    HiOutlineClock,
    HiOutlineGlobe,
    HiOutlineCheck,
    HiOutlineExternalLink,
    HiOutlineRefresh,
} from 'react-icons/hi';
import { useApp } from '../../context/AppContext';
import './SearchJobs.css';

const platformOptions = [
    'Remotive', 'Himalayas', 'Jobicy', 'Remote OK', 'We Work Remotely',
    'LinkedIn', 'Indeed', 'Naukri', 'Wellfound', 'Cutshort',
    'Instahyre', 'Hirist', 'Otta', 'FlexJobs',
];

export default function SearchJobs() {
    const {
        jobs,
        allJobs,
        filters,
        updateFilters,
        resetFilters,
        applyToJob,
        applications,
        loading,
        error,
        fetchJobs,
        jobSources,
        activeWorkflows
    } = useApp();
    const [showFilters, setShowFilters] = useState(true);
    const hasFetched = useRef(false);

    // Fetch jobs when Search page mounts (only once)
    useEffect(() => {
        if (!hasFetched.current && allJobs.length === 0) {
            hasFetched.current = true;
            fetchJobs(filters.search || '');
        }
    }, []);

    const handleApply = (job) => {
        applyToJob(job);
    };

    const getWorkflow = (job) => {
        return activeWorkflows.find(w => w.id === job.id || (w.jobTitle === job.title && w.company === job.company.name));
    };

    const isApplied = (job) => {
        return applications.some(a => a.id === job.id || (a.jobTitle === job.title && a.company === job.company.name));
    };

    const handleRefresh = () => {
        fetchJobs(filters.search || '');
    };

    return (
        <div className="search-page">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                    <h2>Search Jobs</h2>
                    <span className="live-badge">
                        <span className="live-dot" />
                        LIVE
                    </span>
                </div>
                <p>Real-time jobs from {jobSources.length > 0 ? jobSources.join(', ') : 'multiple platforms'}</p>
            </div>

            {error && (
                <div className="error-banner">
                    ⚠️ {error} — Showing cached results if available.
                    <button className="btn-secondary" onClick={handleRefresh} style={{ marginLeft: 'auto' }}>
                        Retry
                    </button>
                </div>
            )}

            {/* Search Bar */}
            <div className="search-header">
                <div className="search-input-wrapper">
                    <HiOutlineSearch className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by title, company, or skill..."
                        value={filters.search}
                        onChange={e => updateFilters('search', e.target.value)}
                    />
                </div>
                <div className="search-actions">
                    <button className="btn-secondary" onClick={handleRefresh} title="Refresh jobs">
                        <HiOutlineRefresh style={{ fontSize: '1.1rem' }} />
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <HiOutlineAdjustments />
                        Filters
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="filter-panel">
                    <div className="filter-grid">
                        <div className="filter-group">
                            <label>Role</label>
                            <select
                                value={filters.role}
                                onChange={e => updateFilters('role', e.target.value)}
                            >
                                <option value="">All Roles</option>
                                <option value="frontend">Frontend</option>
                                <option value="backend">Backend</option>
                                <option value="full stack">Full Stack</option>
                                <option value="devops">DevOps</option>
                                <option value="data">Data Science</option>
                                <option value="product">Product</option>
                                <option value="design">Design</option>
                                <option value="mobile">Mobile</option>
                                <option value="engineering">Engineering</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>Location</label>
                            <input
                                type="text"
                                placeholder="e.g. India, Remote, USA"
                                value={filters.location}
                                onChange={e => updateFilters('location', e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
                            <label>Platform</label>
                            <select
                                value={filters.platform}
                                onChange={e => updateFilters('platform', e.target.value)}
                            >
                                <option value="">All Platforms</option>
                                {platformOptions.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group">
                            <label>Remote Only</label>
                            <div className="filter-toggle">
                                <div
                                    className={`toggle-switch ${filters.remote ? 'active' : ''}`}
                                    onClick={() => updateFilters('remote', !filters.remote)}
                                />
                                <span className="toggle-label">{filters.remote ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="filter-actions">
                        <button className="btn-secondary" onClick={resetFilters}>
                            Reset Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Results */}
            <div className="results-header">
                <span className="results-count">
                    {loading ? 'Fetching live jobs...' : <>Showing <strong>{jobs.length}</strong> live jobs</>}
                </span>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <span className="loading-text">Fetching live jobs from 14 platforms...</span>
                </div>
            ) : jobs.length > 0 ? (
                <div className="jobs-grid">
                    {jobs.map((job, i) => {
                        const applied = isApplied(job);
                        const workflow = getWorkflow(job);
                        return (
                            <div
                                key={job.id}
                                className="job-card"
                                style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                            >
                                <div className="job-card-header">
                                    <div className="job-card-logo">
                                        {job.company.logo ? (
                                            <img
                                                src={`http://localhost:3001/api/proxy-image?url=${encodeURIComponent(job.company.logo)}`}
                                                alt={job.company.name}
                                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'var(--radius-sm)' }}
                                                onError={(e) => {
                                                    // If proxy failed, don't try direct (it'll fail CORS anyway)
                                                    // Just hide the image and show characters
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.textContent = job.company.name?.charAt(0) || '💼';
                                                }}
                                            />
                                        ) : (
                                            <span>{job.company.name?.charAt(0) || '💼'}</span>
                                        )}
                                    </div>
                                    <div className="job-card-title-group">
                                        <div className="job-card-title">{job.title}</div>
                                        <div className="job-card-company">{job.company.name}</div>
                                    </div>
                                </div>

                                <div className="job-card-meta">
                                    <span className="job-card-meta-item">
                                        <HiOutlineLocationMarker /> {job.location}
                                    </span>
                                    {job.salary && job.salary !== 'Not disclosed' && (
                                        <span className="job-card-meta-item">
                                            <HiOutlineCurrencyRupee /> {job.salary}
                                        </span>
                                    )}
                                    {job.experience && (
                                        <span className="job-card-meta-item">
                                            <HiOutlineClock /> {job.experience}
                                        </span>
                                    )}
                                    {job.remote && (
                                        <span className="job-card-meta-item">
                                            <HiOutlineGlobe /> Remote
                                        </span>
                                    )}
                                </div>

                                <div className="job-card-tags">
                                    {(job.tags || []).map(tag => (
                                        <span key={tag} className="job-card-tag">{tag}</span>
                                    ))}
                                </div>

                                <div className="job-card-footer">
                                    <span className="job-card-platform">
                                        via {job.platform} • {job.postedDate}
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {job.url && (
                                            <a
                                                href={job.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-secondary"
                                                style={{ padding: '8px 14px', fontSize: 'var(--font-size-xs)' }}
                                                title="View on platform"
                                            >
                                                <HiOutlineExternalLink />
                                            </a>
                                        )}

                                        {workflow ? (
                                            <div className="job-card-workflow">
                                                <div className="workflow-status">
                                                    <span className={`status-dot ${workflow.status}`} />
                                                    {workflow.status === 'completed' ? 'Applied!' : 'Applying...'}
                                                </div>
                                                <div className="workflow-progress-bg">
                                                    <div
                                                        className="workflow-progress-bar"
                                                        style={{ width: `${workflow.progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : applied ? (
                                            <span className="job-card-applied-badge">
                                                <HiOutlineCheck style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                                Applied
                                            </span>
                                        ) : (
                                            <button
                                                className="job-card-apply-btn"
                                                onClick={() => handleApply(job)}
                                            >
                                                Quick Apply
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3>No jobs match your filters</h3>
                    <p>Try adjusting your search criteria or reset filters</p>
                </div>
            )}
        </div>
    );
}
