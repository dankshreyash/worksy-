import fetch from 'node-fetch';

// ============================================
// HELPERS (defined first for use by all sources)
// ============================================

function decodeEntities(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&#8211;/g, '–')
        .replace(/&#8212;/g, '—')
        .replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

function stripHtml(html) {
    return decodeEntities((html || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function formatDate(dateStr) {
    if (!dateStr) return 'Recently';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Recently';
        if (date.getFullYear() < 2020) return 'Recently';
        const now = new Date();
        const diffMs = now - date;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffHrs < 0) return 'Recently';
        if (diffHrs < 1) return 'Just now';
        if (diffHrs < 24) return `${diffHrs} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        return date.toLocaleDateString();
    } catch {
        return 'Recently';
    }
}

function formatSalary(min, max, currency = 'USD') {
    if (!min && !max) return 'Not disclosed';
    const sym = currency === 'INR' ? '₹' : '$';
    if (min && max) return `${sym}${(min / 1000).toFixed(0)}K - ${sym}${(max / 1000).toFixed(0)}K`;
    if (min) return `${sym}${(min / 1000).toFixed(0)}K+`;
    return `Up to ${sym}${(max / 1000).toFixed(0)}K`;
}

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
};

function safeFetch(url, opts = {}) {
    return fetch(url, {
        headers: { ...HEADERS, ...opts.headers },
        signal: AbortSignal.timeout(opts.timeout || 15000),
        ...opts,
    });
}

// Extracts JSON array from an RSS XML string
function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const getTag = (tag) => {
            const m = content.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
            return m ? stripHtml(m[1].trim()) : '';
        };
        items.push({
            title: getTag('title'),
            link: getTag('link'),
            description: getTag('description'),
            pubDate: getTag('pubDate'),
            category: getTag('category'),
        });
    }
    return items;
}


// ============================================
// 1. REMOTIVE — Remote Jobs (Free API)
// ============================================
export async function fetchRemotiveJobs(options = {}) {
    try {
        const params = new URLSearchParams();
        if (options.search) params.set('search', options.search);
        params.set('limit', options.limit || 20);
        const res = await safeFetch(`https://remotive.com/api/remote-jobs?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        return (data.jobs || []).map(job => ({
            id: `remotive-${job.id}`,
            title: decodeEntities(job.title),
            company: { name: decodeEntities(job.company_name), logo: job.company_logo || null },
            location: job.candidate_required_location || 'Remote',
            salary: job.salary || 'Not disclosed',
            type: job.job_type ? job.job_type.replace(/_/g, ' ') : 'Full-time',
            remote: true,
            experience: '',
            platform: 'Remotive',
            tags: [job.category, ...(job.tags || [])].filter(Boolean).slice(0, 5),
            postedDate: formatDate(job.publication_date),
            description: stripHtml(job.description).slice(0, 200) + '...',
            url: job.url,
        }));
    } catch (err) {
        console.error('❌ Remotive:', err.message);
        return [];
    }
}


// ============================================
// 2. HIMALAYAS — Tech / Remote Jobs (Free API)
// ============================================
export async function fetchHimalayasJobs(options = {}) {
    try {
        const params = new URLSearchParams();
        params.set('limit', options.limit || 20);
        const res = await safeFetch(`https://himalayas.app/jobs/api?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        return (data.jobs || []).map((job, i) => ({
            id: `himalayas-${job.id || i}-${Date.now()}`,
            title: decodeEntities(job.title),
            company: { name: decodeEntities(job.companyName || 'Unknown'), logo: job.companyLogo || null },
            location: job.locationRestrictions?.length ? job.locationRestrictions.join(', ') : 'Worldwide',
            salary: formatSalary(job.minSalary, job.maxSalary, job.salaryCurrency),
            type: job.type || 'Full-time',
            remote: true,
            experience: job.seniority || '',
            platform: 'Himalayas',
            tags: (job.categories || []).slice(0, 5),
            postedDate: formatDate(job.pubDate || job.postedDate),
            description: stripHtml(job.description || '').slice(0, 200) + '...',
            url: job.applicationLink || `https://himalayas.app/jobs/${job.slug}`,
        }));
    } catch (err) {
        console.error('❌ Himalayas:', err.message);
        return [];
    }
}


// ============================================
// 3. JOBICY — Remote Jobs (Free API)
// ============================================
export async function fetchJobicyJobs(options = {}) {
    try {
        const params = new URLSearchParams();
        params.set('count', options.limit || 20);
        if (options.tag) params.set('tag', options.tag);
        const res = await safeFetch(`https://jobicy.com/api/v2/remote-jobs?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        return (data.jobs || []).map((job, i) => ({
            id: `jobicy-${job.id || i}-${Date.now()}`,
            title: decodeEntities(job.jobTitle),
            company: { name: decodeEntities(job.companyName), logo: job.companyLogo || null },
            location: job.jobGeo || 'Remote',
            salary: job.annualSalaryMin && job.annualSalaryMax
                ? `$${(job.annualSalaryMin / 1000).toFixed(0)}K - $${(job.annualSalaryMax / 1000).toFixed(0)}K`
                : 'Not disclosed',
            type: job.jobType || 'Full-time',
            remote: true,
            experience: job.jobLevel || '',
            platform: 'Jobicy',
            tags: (job.jobIndustry || []).concat(job.jobFunction || []).filter(Boolean).slice(0, 5).map(t => decodeEntities(t)),
            postedDate: formatDate(job.pubDate),
            description: stripHtml(job.jobDescription || job.jobExcerpt || '').slice(0, 200) + '...',
            url: job.url,
        }));
    } catch (err) {
        console.error('❌ Jobicy:', err.message);
        return [];
    }
}


// ============================================
// 4. REMOTE OK — Remote Jobs (Free JSON API)
// ============================================
export async function fetchRemoteOKJobs(options = {}) {
    try {
        const res = await safeFetch('https://remoteok.com/api', {
            headers: { ...HEADERS, 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        let data = await res.json();
        // First item is metadata, skip it
        if (Array.isArray(data) && data.length > 0 && data[0].legal) data = data.slice(1);
        return data.slice(0, options.limit || 20).map(job => ({
            id: `remoteok-${job.id}`,
            title: decodeEntities(job.position || job.title || ''),
            company: { name: decodeEntities(job.company || 'Unknown'), logo: job.company_logo || job.logo || null },
            location: job.location || 'Remote',
            salary: job.salary_min && job.salary_max
                ? `$${(job.salary_min / 1000).toFixed(0)}K - $${(job.salary_max / 1000).toFixed(0)}K`
                : 'Not disclosed',
            type: 'Full-time',
            remote: true,
            experience: '',
            platform: 'Remote OK',
            tags: (job.tags || []).slice(0, 5),
            postedDate: formatDate(job.date),
            description: stripHtml(job.description || '').slice(0, 200) + '...',
            url: job.url ? `https://remoteok.com${job.url}` : `https://remoteok.com/remote-jobs/${job.id}`,
        }));
    } catch (err) {
        console.error('❌ Remote OK:', err.message);
        return [];
    }
}


// ============================================
// 5. WE WORK REMOTELY — Remote Jobs (RSS Feed)
// ============================================
export async function fetchWWRJobs(options = {}) {
    try {
        const feeds = [
            'https://weworkremotely.com/categories/remote-programming-jobs.rss',
            'https://weworkremotely.com/categories/remote-design-jobs.rss',
            'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
        ];
        const results = await Promise.allSettled(
            feeds.map(url => safeFetch(url).then(r => r.text()))
        );
        const allItems = [];
        for (const r of results) {
            if (r.status === 'fulfilled') allItems.push(...parseRSS(r.value));
        }
        return allItems.slice(0, options.limit || 20).map((item, i) => {
            const titleParts = item.title.split(':');
            const company = titleParts.length > 1 ? titleParts[0].trim() : 'Unknown';
            const jobTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : item.title;
            return {
                id: `wwr-${i}-${Date.now()}`,
                title: decodeEntities(jobTitle),
                company: { name: decodeEntities(company), logo: null },
                location: 'Remote',
                salary: 'Not disclosed',
                type: 'Full-time',
                remote: true,
                experience: '',
                platform: 'We Work Remotely',
                tags: item.category ? [item.category] : ['Remote'],
                postedDate: formatDate(item.pubDate),
                description: stripHtml(item.description).slice(0, 200) + '...',
                url: item.link,
            };
        });
    } catch (err) {
        console.error('❌ We Work Remotely:', err.message);
        return [];
    }
}


// ============================================
// 6. LINKEDIN JOBS — Guest API Scraping
// ============================================
export async function fetchLinkedInJobs(options = {}) {
    try {
        const keywords = options.search || 'software developer';
        const params = new URLSearchParams({
            keywords,
            location: 'India',
            start: '0',
            sortBy: 'DD',
        });
        const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`;
        const res = await safeFetch(url, {
            headers: {
                ...HEADERS,
                'Accept': 'text/html',
            },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const html = await res.text();
        console.log(`📡 LinkedIn Response: ${res.status}, Length: ${html.length}`);

        // Parse job cards from HTML - Improved regex
        const jobs = [];
        // Look for the list items or card divs
        const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
        const titleRegex = /<h3[^>]*base-search-card__title[^>]*>([\s\S]*?)<\/h3>/;
        const companyRegex = /<h4[^>]*base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/;
        const locationRegex = /<span[^>]*job-search-card__location[^>]*>([\s\S]*?)<\/span>/;
        const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>/;
        const dateRegex = /<time[^>]*datetime="([^"]*)"[^>]*>/;
        const logoRegex = /<img[^>]*data-delayed-url="([^"]*)"[^>]*>/;

        let card;
        while ((card = cardRegex.exec(html)) !== null) {
            const c = card[0];
            const title = titleRegex.exec(c);
            const company = companyRegex.exec(c);
            const location = locationRegex.exec(c);
            const link = linkRegex.exec(c);
            const date = dateRegex.exec(c);
            const logo = logoRegex.exec(c);

            if (title) {
                jobs.push({
                    id: `linkedin-${jobs.length}-${Date.now()}`,
                    title: stripHtml(title[1]),
                    company: { name: stripHtml(company?.[1] || 'Unknown'), logo: logo?.[1] || null },
                    location: stripHtml(location?.[1] || 'India'),
                    salary: 'Not disclosed',
                    type: 'Full-time',
                    remote: stripHtml(location?.[1] || '').toLowerCase().includes('remote'),
                    experience: '',
                    platform: 'LinkedIn',
                    tags: ['LinkedIn Job'],
                    postedDate: formatDate(date?.[1]),
                    description: `${stripHtml(title[1])} at ${stripHtml(company?.[1] || 'company')}`,
                    url: link?.[1]?.split('?')[0] || 'https://linkedin.com/jobs',
                });
            }
        }
        console.log(`✅ LinkedIn: ${jobs.length} jobs`);
        return jobs.slice(0, options.limit || 15);
    } catch (err) {
        console.error('❌ LinkedIn:', err.message);
        return [];
    }
}


// ============================================
// 7. INDEED — Guest Scraping
// ============================================
export async function fetchIndeedJobs(options = {}) {
    try {
        const keywords = encodeURIComponent(options.search || 'software engineer');
        const url = `https://in.indeed.com/jobs?q=${keywords}&l=India&sort=date`;

        const res = await safeFetch(url, {
            headers: {
                ...HEADERS,
                'Referer': 'https://in.indeed.com/',
            },
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const html = await res.text();
        console.log(`📡 Indeed Response: ${res.status}, Length: ${html.length}`);

        const jobs = [];
        // Match Indeed job cards
        const cardRegex = /<div[^>]*class="[^"]*job_seen_beacon[^"]*"[\s\S]*?<\/div>\s*<\/div>/g;
        const titleRegex = /<h2[^>]*class="[^"]*jobTitle[^>]*>([\s\S]*?)<\/h2>/;
        const companyRegex = /<span[^>]*data-testid="company-name"[^>]*>([\s\S]*?)<\/span>/;
        const locationRegex = /<div[^>]*data-testid="text-location"[^>]*>([\s\S]*?)<\/div>/;
        const dateRegex = /<span[^>]*class="date"[^>]*>([\s\S]*?)<\/span>/;

        let card;
        while ((card = cardRegex.exec(html)) !== null) {
            const c = card[0];
            const titleMatch = titleRegex.exec(c);
            const companyMatch = companyRegex.exec(c);
            const locationMatch = locationRegex.exec(c);
            const dateMatch = dateRegex.exec(c);

            const jkMatch = /data-jk="([^"]*)"/.exec(c);

            if (titleMatch) {
                const titleStr = stripHtml(titleMatch[1]).replace(/^new/i, '').trim();
                jobs.push({
                    id: `indeed-${jkMatch?.[1] || jobs.length}-${Date.now()}`,
                    title: titleStr,
                    company: {
                        name: stripHtml(companyMatch?.[1] || 'Unknown公司'),
                        logo: null
                    },
                    location: stripHtml(locationMatch?.[1] || 'India'),
                    salary: 'Not disclosed',
                    type: 'Full-time',
                    remote: stripHtml(locationMatch?.[1] || '').toLowerCase().includes('remote'),
                    experience: '',
                    platform: 'Indeed',
                    tags: ['Indeed'],
                    postedDate: stripHtml(dateMatch?.[1] || 'Recently'),
                    description: `Job at ${stripHtml(companyMatch?.[1] || 'company')}`,
                    url: jkMatch ? `https://in.indeed.com/viewjob?jk=${jkMatch[1]}` : 'https://in.indeed.com',
                });
            }
        }

        console.log(`✅ Indeed: ${jobs.length} jobs`);
        return jobs.slice(0, options.limit || 15);
    } catch (err) {
        console.error('❌ Indeed:', err.message);
        return [];
    }
}


// ============================================
// 8. NAUKRI — Scraping Attempt
// ============================================
export async function fetchNaukriJobs(options = {}) {
    try {
        const query = options.search || 'software developer';
        const url = `https://www.naukri.com/jobapi/v3/search?noOfResults=20&urlType=search_by_key_loc&searchType=adv&keyword=${encodeURIComponent(query)}&location=India&pageNo=1&sort=f&experience=0`;
        const res = await safeFetch(url, {
            headers: {
                ...HEADERS,
                'appid': '109',
                'systemid': 'Naukri',
                'Accept': 'application/json',
            },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        return (data.jobDetails || []).slice(0, options.limit || 15).map(job => ({
            id: `naukri-${job.jdId || job.jobId || Date.now()}`,
            title: decodeEntities(job.title || job.designation || ''),
            company: { name: decodeEntities(job.companyName || 'Unknown'), logo: job.logoUrl || job.companyLogo || null },
            location: job.placeholders?.find(p => p.type === 'location')?.label || job.location || 'India',
            salary: job.placeholders?.find(p => p.type === 'salary')?.label || job.salary || 'Not disclosed',
            type: job.jobType || 'Full-time',
            remote: (job.location || '').toLowerCase().includes('remote') || (job.wfhType || '') !== '',
            experience: job.placeholders?.find(p => p.type === 'experience')?.label || job.experience || '',
            platform: 'Naukri',
            tags: (job.tagsAndSkills || '').split(',').filter(Boolean).slice(0, 5).map(s => s.trim()),
            postedDate: formatDate(job.createdDate || job.footerPlaceholderLabel),
            description: stripHtml(job.jobDescription || job.snippet || '').slice(0, 200) + '...',
            url: `https://www.naukri.com${job.jdURL || ''}`,
        }));
    } catch (err) {
        console.error('❌ Naukri:', err.message);
        return [];
    }
}


// ============================================
// 9. WELLFOUND (AngelList Talent) — GraphQL
// ============================================
export async function fetchWellfoundJobs(options = {}) {
    try {
        const query = options.search || 'software engineer';
        const url = `https://wellfound.com/api/search?query=${encodeURIComponent(query)}&page=1&per_page=20&type=jobs`;
        const res = await safeFetch(url, {
            headers: {
                ...HEADERS,
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const jobs = data.results || data.jobs || data.hits || [];
        return jobs.slice(0, options.limit || 15).map((job, i) => ({
            id: `wellfound-${job.id || i}-${Date.now()}`,
            title: decodeEntities(job.title || job.name || ''),
            company: {
                name: decodeEntities(job.startup?.name || job.company_name || job.company || 'Startup'),
                logo: job.startup?.logo_url || job.company_logo || null,
            },
            location: job.locations?.join(', ') || job.location || 'Remote',
            salary: job.compensation ? `$${job.compensation}` : 'Equity + Salary',
            type: job.job_type || 'Full-time',
            remote: job.remote || (job.location || '').toLowerCase().includes('remote'),
            experience: job.experience_level || '',
            platform: 'Wellfound',
            tags: (job.tags || job.skills || []).slice(0, 5).map(t => typeof t === 'string' ? t : t.name || ''),
            postedDate: formatDate(job.created_at || job.published_at),
            description: stripHtml(job.description || job.pitch || '').slice(0, 200) + '...',
            url: job.url || `https://wellfound.com/jobs/${job.slug || job.id}`,
        }));
    } catch (err) {
        console.error('❌ Wellfound:', err.message);
        return [];
    }
}


// ============================================
// 10. CUTSHORT — Scraping
// ============================================
export async function fetchCutshortJobs(options = {}) {
    try {
        const res = await safeFetch('https://cutshort.io/api/public/job-listings?page=1&limit=20', {
            headers: { ...HEADERS, 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const jobs = data.data || data.jobs || data.results || [];
        return jobs.slice(0, options.limit || 15).map((job, i) => ({
            id: `cutshort-${job.id || job._id || i}`,
            title: decodeEntities(job.title || job.designation || ''),
            company: { name: decodeEntities(job.company?.name || job.companyName || 'Startup'), logo: job.company?.logo || null },
            location: job.location || job.city || 'India',
            salary: job.salary || job.ctc || 'Not disclosed',
            type: job.type || 'Full-time',
            remote: job.remote || (job.location || '').toLowerCase().includes('remote'),
            experience: job.experience || '',
            platform: 'Cutshort',
            tags: (job.skills || job.tags || []).slice(0, 5).map(s => typeof s === 'string' ? s : s.name || ''),
            postedDate: formatDate(job.createdAt || job.postedAt),
            description: stripHtml(job.description || '').slice(0, 200) + '...',
            url: job.url || `https://cutshort.io/job/${job.slug || job.id}`,
        }));
    } catch (err) {
        console.error('❌ Cutshort:', err.message);
        return [];
    }
}


// ============================================
// 11. INSTAHYRE — Scraping
// ============================================
export async function fetchInstahyreJobs(options = {}) {
    try {
        const res = await safeFetch('https://www.instahyre.com/api/v1/search-jobs/?page=1', {
            headers: { ...HEADERS, 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const jobs = data.opportunities || data.results || data.jobs || [];
        return jobs.slice(0, options.limit || 15).map((job, i) => ({
            id: `instahyre-${job.id || i}`,
            title: decodeEntities(job.designation || job.title || ''),
            company: { name: decodeEntities(job.company_name || job.company?.name || 'Company'), logo: job.company_logo || null },
            location: job.location || job.city || 'India',
            salary: job.salary_range || job.salary || 'Not disclosed',
            type: job.job_type || 'Full-time',
            remote: job.remote || (job.location || '').toLowerCase().includes('remote'),
            experience: job.min_experience ? `${job.min_experience}-${job.max_experience || '?'} years` : '',
            platform: 'Instahyre',
            tags: (job.skills || []).slice(0, 5).map(s => typeof s === 'string' ? s : s.name || ''),
            postedDate: formatDate(job.created_at || job.posted_date),
            description: stripHtml(job.description || '').slice(0, 200) + '...',
            url: `https://www.instahyre.com/job/${job.slug || job.id || ''}`,
        }));
    } catch (err) {
        console.error('❌ Instahyre:', err.message);
        return [];
    }
}


// ============================================
// 12. HIRIST — Scraping
// ============================================
export async function fetchHiristJobs(options = {}) {
    try {
        const query = options.search || 'developer';
        const res = await safeFetch(`https://www.hirist.tech/api/jobs?q=${encodeURIComponent(query)}&page=1`, {
            headers: { ...HEADERS, 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const jobs = data.jobs || data.results || data.data || [];
        return jobs.slice(0, options.limit || 15).map((job, i) => ({
            id: `hirist-${job.id || i}`,
            title: decodeEntities(job.title || job.designation || ''),
            company: { name: decodeEntities(job.company || job.company_name || 'Company'), logo: null },
            location: job.location || 'India',
            salary: job.salary || 'Not disclosed',
            type: 'Full-time',
            remote: (job.location || '').toLowerCase().includes('remote'),
            experience: job.experience || '',
            platform: 'Hirist',
            tags: (job.skills || '').split ? (job.skills || '').split(',').filter(Boolean).slice(0, 5) : [],
            postedDate: formatDate(job.posted_date || job.createdAt),
            description: stripHtml(job.description || '').slice(0, 200) + '...',
            url: job.url || `https://www.hirist.tech/j/${job.id || ''}`,
        }));
    } catch (err) {
        console.error('❌ Hirist:', err.message);
        return [];
    }
}


// ============================================
// 13. OTTA — Scraping
// ============================================
export async function fetchOttaJobs(options = {}) {
    try {
        const res = await safeFetch('https://app.otta.com/api/v1/search/jobs?limit=20', {
            headers: { ...HEADERS, 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const jobs = data.results || data.jobs || data.data || [];
        return jobs.slice(0, options.limit || 15).map((job, i) => ({
            id: `otta-${job.id || i}`,
            title: decodeEntities(job.title || job.name || ''),
            company: { name: decodeEntities(job.company?.name || job.organisation?.name || 'Company'), logo: job.company?.logo_url || null },
            location: job.location || 'London / Remote',
            salary: job.salary_range || 'Not disclosed',
            type: job.job_type || 'Full-time',
            remote: job.remote || false,
            experience: job.experience_level || '',
            platform: 'Otta',
            tags: (job.technologies || job.tags || []).slice(0, 5),
            postedDate: formatDate(job.published_at || job.created_at),
            description: stripHtml(job.description || job.summary || '').slice(0, 200) + '...',
            url: `https://app.otta.com/jobs/${job.slug || job.id || ''}`,
        }));
    } catch (err) {
        console.error('❌ Otta:', err.message);
        return [];
    }
}


// ============================================
// 14. FLEXJOBS — Scraping
// ============================================
export async function fetchFlexJobs(options = {}) {
    try {
        const query = options.search || 'software developer';
        const res = await safeFetch(`https://www.flexjobs.com/api/search?search=${encodeURIComponent(query)}&page=1`, {
            headers: { ...HEADERS, 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const jobs = data.jobs || data.results || [];
        return jobs.slice(0, options.limit || 15).map((job, i) => ({
            id: `flexjobs-${job.id || i}`,
            title: decodeEntities(job.title || ''),
            company: { name: decodeEntities(job.company || 'Company'), logo: null },
            location: job.location || 'Remote',
            salary: job.salary || 'Not disclosed',
            type: job.schedule || 'Full-time',
            remote: true,
            experience: '',
            platform: 'FlexJobs',
            tags: (job.categories || []).slice(0, 5),
            postedDate: formatDate(job.posted_date || job.pubDate),
            description: stripHtml(job.description || '').slice(0, 200) + '...',
            url: job.url || `https://www.flexjobs.com/job/${job.id || ''}`,
        }));
    } catch (err) {
        console.error('❌ FlexJobs:', err.message);
        return [];
    }
}


// ============================================
// 15. COGNIZANT — Careers RSS Feed
// ============================================
export async function fetchCognizantJobs(options = {}) {
    try {
        const res = await safeFetch('https://careers.cognizant.com/global-en/jobs/xml/?rss=true', {
            timeout: 20000,
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const xml = await res.text();

        // Parse <item> blocks from RSS
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null && items.length < (options.limit || 25)) {
            const content = match[1];
            const getTag = (tag) => {
                const m = content.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 's'));
                return m ? m[1].trim() : '';
            };
            const title = stripHtml(getTag('title'));
            const link = getTag('link') || getTag('guid');
            const location = stripHtml(getTag('location') || getTag('city') || '');
            const category = stripHtml(getTag('category'));
            const pubDate = getTag('pubDate');

            if (title && title !== 'Cognizant Careers') {
                items.push({
                    id: `cognizant-${items.length}-${Date.now()}`,
                    title: decodeEntities(title),
                    company: { name: 'Cognizant', logo: 'https://logo.clearbit.com/cognizant.com' },
                    location: location || 'India',
                    salary: 'Not disclosed',
                    type: 'Full-time',
                    remote: location.toLowerCase().includes('remote'),
                    experience: '',
                    platform: 'Cognizant',
                    tags: category ? [category, 'WITCH'] : ['Cognizant', 'WITCH'],
                    postedDate: formatDate(pubDate),
                    description: `${title} at Cognizant`,
                    url: link || 'https://careers.cognizant.com',
                });
            }
        }
        console.log(`✅ Cognizant: ${items.length} jobs`);
        return items;
    } catch (err) {
        console.error('❌ Cognizant:', err.message);
        return [];
    }
}


// ============================================
// 16. WITCH COMPANIES — LinkedIn Guest API
// TCS, Infosys, HCL, Wipro
// ============================================
export async function fetchWITCHLinkedInJobs(options = {}) {
    const companies = [
        { name: 'TCS', query: 'TCS Tata Consultancy Services' },
        { name: 'Infosys', query: 'Infosys' },
        { name: 'HCL Technologies', query: 'HCL Technologies' },
        { name: 'Wipro', query: 'Wipro' },
    ];

    const allJobs = [];

    const results = await Promise.allSettled(
        companies.map(async (company) => {
            try {
                const params = new URLSearchParams({
                    keywords: company.query,
                    location: 'India',
                    start: '0',
                    sortBy: 'DD',
                });
                const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`;
                const res = await safeFetch(url, {
                    headers: { ...HEADERS, 'Accept': 'text/html' },
                });
                if (!res.ok) throw new Error(`${res.status}`);
                const html = await res.text();

                const jobs = [];
                const cardRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
                const titleRegex = /<h3[^>]*base-search-card__title[^>]*>([\s\S]*?)<\/h3>/;
                const companyRegex = /<h4[^>]*base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/;
                const locationRegex = /<span[^>]*job-search-card__location[^>]*>([\s\S]*?)<\/span>/;
                const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>/;
                const dateRegex = /<time[^>]*datetime="([^"]*)"[^>]*>/;

                let card;
                while ((card = cardRegex.exec(html)) !== null && jobs.length < 8) {
                    const c = card[0];
                    const title = titleRegex.exec(c);
                    const comp = companyRegex.exec(c);
                    const location = locationRegex.exec(c);
                    const link = linkRegex.exec(c);
                    const date = dateRegex.exec(c);
                    const companyName = stripHtml(comp?.[1] || company.name);

                    if (title) {
                        jobs.push({
                            id: `witch-${company.name.toLowerCase().replace(/\s/g, '')}-${jobs.length}-${Date.now()}`,
                            title: stripHtml(title[1]),
                            company: { name: companyName, logo: null },
                            location: stripHtml(location?.[1] || 'India'),
                            salary: 'Not disclosed',
                            type: 'Full-time',
                            remote: stripHtml(location?.[1] || '').toLowerCase().includes('remote'),
                            experience: '',
                            platform: company.name,
                            tags: [company.name, 'WITCH', 'IT Services'],
                            postedDate: formatDate(date?.[1]),
                            description: `${stripHtml(title[1])} at ${companyName}`,
                            url: link?.[1]?.split('?')[0] || 'https://linkedin.com/jobs',
                        });
                    }
                }
                console.log(`✅ ${company.name}: ${jobs.length} jobs (via LinkedIn)`);
                return jobs;
            } catch (err) {
                console.error(`❌ ${company.name}:`, err.message);
                return [];
            }
        })
    );

    for (const r of results) {
        if (r.status === 'fulfilled') allJobs.push(...r.value);
    }
    return allJobs;
}


// ============================================
// AGGREGATOR — Fetch ALL sources + merge + cache
// ============================================

let cache = { data: null, timestamp: 0 };
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchAllJobs(options = {}) {
    const now = Date.now();

    if (!options.search && cache.data && (now - cache.timestamp) < CACHE_TTL) {
        console.log(`📦 Serving ${cache.data.length} cached jobs`);
        return cache.data;
    }

    console.log('🔄 Fetching from all job sources...');
    const startTime = Date.now();

    const results = await Promise.allSettled([
        fetchRemotiveJobs(options),
        fetchHimalayasJobs(options),
        fetchJobicyJobs(options),
        fetchRemoteOKJobs(options),
        fetchWWRJobs(options),
        fetchLinkedInJobs(options),
        fetchIndeedJobs(options),
        fetchNaukriJobs(options),
        fetchWellfoundJobs(options),
        fetchCutshortJobs(options),
        fetchInstahyreJobs(options),
        fetchHiristJobs(options),
        fetchOttaJobs(options),
        fetchFlexJobs(options),
        fetchCognizantJobs(options),
        fetchWITCHLinkedInJobs(options),
    ]);

    const sourceNames = [
        'Remotive', 'Himalayas', 'Jobicy', 'Remote OK', 'We Work Remotely',
        'LinkedIn', 'Indeed', 'Naukri', 'Wellfound', 'Cutshort',
        'Instahyre', 'Hirist', 'Otta', 'FlexJobs',
        'Cognizant', 'WITCH (TCS/Infosys/HCL/Wipro)',
    ];

    const allJobs = [];
    const sourceCounts = {};

    results.forEach((result, i) => {
        const name = sourceNames[i];
        if (result.status === 'fulfilled' && result.value.length > 0) {
            sourceCounts[name] = result.value.length;
            allJobs.push(...result.value);
        } else {
            sourceCounts[name] = 0;
        }
    });

    // Deduplicate by normalized title+company
    const seen = new Set();
    const unique = allJobs.filter(job => {
        const key = `${(job.title || '').toLowerCase().trim()}-${(job.company?.name || '').toLowerCase().trim()}`;
        if (seen.has(key) || !job.title) return false;
        seen.add(key);
        return true;
    });

    // Sort: recent first
    const sorted = unique.sort((a, b) => {
        const order = ['Just now', 'hours ago', 'day', 'week', 'Recently'];
        const scoreA = order.findIndex(k => a.postedDate.includes(k));
        const scoreB = order.findIndex(k => b.postedDate.includes(k));
        return (scoreA === -1 ? 99 : scoreA) - (scoreB === -1 ? 99 : scoreB);
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n📊 Fetch complete in ${elapsed}s — ${sorted.length} unique jobs from ${Object.values(sourceCounts).filter(c => c > 0).length} sources:`);
    for (const [name, count] of Object.entries(sourceCounts)) {
        console.log(`   ${count > 0 ? '✅' : '⚠️'} ${name}: ${count} jobs`);
    }

    if (!options.search) {
        cache = { data: sorted, timestamp: now };
    }

    return sorted;
}

export function getSourceStats() {
    return {
        sources: [
            'Remotive', 'Himalayas', 'Jobicy', 'Remote OK', 'We Work Remotely',
            'LinkedIn', 'Indeed', 'Naukri', 'Wellfound', 'Cutshort',
            'Instahyre', 'Hirist', 'Otta', 'FlexJobs',
            'Cognizant', 'TCS', 'Infosys', 'HCL', 'Wipro',
        ],
        description: 'Aggregating jobs from 19 platforms — including WITCH companies (TCS, Infosys, HCL, Wipro, Cognizant)',
    };
}
