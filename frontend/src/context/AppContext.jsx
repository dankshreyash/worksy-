import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AppContext = createContext();

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export function AppProvider({ children }) {
    // Jobs state — live from API
    const [jobs, setJobs] = useState([]);
    const [allJobs, setAllJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [jobSources, setJobSources] = useState([]);

    // Active Workflows (Running bots)
    const [activeWorkflows, setActiveWorkflows] = useState([]);

    // Applications (local state)
    const [applications, setApplications] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        role: '',
        location: '',
        remote: false,
        experience: '',
        salary: '',
        platform: '',
        startup: false,
    });

    // Theme
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('worksy-theme') || 'dark';
    });

    // Apply theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('worksy-theme', theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    }, []);

    // Fetch live jobs from backend
    const fetchJobs = useCallback(async (search = '') => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            params.set('limit', '50');

            const res = await fetch(`${API_BASE}/jobs?${params}`);
            if (!res.ok) throw new Error(`API error ${res.status}`);
            const data = await res.json();

            if (data.success) {
                setAllJobs(data.jobs);
                setJobs(data.jobs);
            } else {
                throw new Error(data.error || 'Failed to fetch');
            }
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch sources
    useEffect(() => {
        fetch(`${API_BASE}/sources`)
            .then(r => r.json())
            .then(data => setJobSources(data.sources || []))
            .catch(() => { });
    }, []);

    // No initial fetch — jobs load when Search page mounts

    // Apply local filters to fetched jobs
    const filteredJobs = allJobs.filter(job => {
        if (filters.search) {
            const q = filters.search.toLowerCase();
            const match = job.title.toLowerCase().includes(q) ||
                job.company.name.toLowerCase().includes(q) ||
                (job.tags || []).some(t => t.toLowerCase().includes(q));
            if (!match) return false;
        }
        if (filters.role && !job.title.toLowerCase().includes(filters.role.toLowerCase())) return false;
        if (filters.location && !job.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
        if (filters.remote && !job.remote) return false;
        if (filters.platform && job.platform !== filters.platform) return false;
        if (filters.experience && job.experience) {
            if (!job.experience.toLowerCase().includes(filters.experience.toLowerCase())) return false;
        }
        return true;
    });

    const applyToJob = useCallback(async (job) => {
        // Add to active workflows immediately
        const workflowId = Date.now();
        const newWorkflow = {
            id: workflowId,
            jobTitle: job.title,
            company: job.company.name,
            startTime: new Date().toISOString(),
            status: 'initializing',
            progress: 10
        };

        setActiveWorkflows(prev => [newWorkflow, ...prev]);

        try {
            const res = await fetch(`${API_BASE}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job,
                    user: {
                        name: 'Shreyash G.'
                    }
                })
            });

            if (!res.ok) throw new Error('Automation failed to start');
            const data = await res.json();

            if (data.success) {
                // Update workflow status
                setActiveWorkflows(prev => prev.map(w =>
                    w.id === workflowId ? { ...w, status: 'processing', progress: 30 } : w
                ));

                // Add to applications with "applied" status (simulated)
                const newApp = {
                    id: workflowId,
                    jobTitle: job.title,
                    company: job.company.name,
                    companyLogo: job.company.logo || '💼',
                    platform: job.platform,
                    appliedDate: new Date().toISOString().split('T')[0],
                    status: 'applied',
                    salary: job.salary,
                    location: job.location,
                    url: job.url,
                };
                setApplications(prev => [newApp, ...prev]);

                // Simulate progress completion
                setTimeout(() => {
                    setActiveWorkflows(prev => prev.map(w =>
                        w.id === workflowId ? { ...w, status: 'completed', progress: 100 } : w
                    ));
                    // Cleanup completed workflows after 5 seconds
                    setTimeout(() => {
                        setActiveWorkflows(prev => prev.filter(w => w.id !== workflowId));
                    }, 5000);
                }, 3000);
            }
        } catch (err) {
            console.error('Apply error:', err);
            setActiveWorkflows(prev => prev.map(w =>
                w.id === workflowId ? { ...w, status: 'failed', error: err.message } : w
            ));
        }
    }, []);

    const updateFilters = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetFilters = useCallback(() => {
        setFilters({
            search: '',
            role: '',
            location: '',
            remote: false,
            experience: '',
            salary: '',
            platform: '',
            startup: false,
        });
    }, []);



    return (
        <AppContext.Provider value={{
            jobs: filteredJobs,
            allJobs,
            applications,
            filters,
            loading,
            error,
            jobSources,
            theme,
            activeWorkflows,
            toggleTheme,
            fetchJobs,
            applyToJob,
            updateFilters,
            resetFilters,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
}

export default AppContext;
