# Job Fetch & Display Comparison: Home.tsx vs Jobs.tsx

## Executive Summary

The **Homepage "Featured Jobs" section uses hardcoded mock data**, while the **main Jobs page fetches live data from Supabase**. This is the primary reason why some jobs might not appear on the homepage—they're not dynamically selected at all.

---

## Detailed Comparison

### 1. Data Source & Fetching Strategy

#### Home.tsx (Featured Jobs Section)
- **Data Source**: Hardcoded static array (lines 24-29)
- **Type**: Mock/placeholder data
- **Example**:
  ```javascript
  const featuredJobs = [
    { title: 'Senior Frontend Engineer', company: 'TechCorp', location: 'Remote', salary: '₦120k–₦160k', match: '98%', badge: 'Hot' },
    { title: 'Product Manager', company: 'InnovateCo', location: 'New York', salary: '₦110k–₦140k', match: '92%', badge: 'New' },
    { title: 'Data Scientist', company: 'DataFlow', location: 'San Francisco', salary: '₦130k–₦170k', match: '89%', badge: '' },
    { title: 'UX Designer', company: 'DesignHub', location: 'Hybrid', salary: '₦90k–₦120k', match: '95%', badge: 'Featured' },
  ];
  ```
- **Update Frequency**: Never—these are hardcoded values
- **Database Connection**: ❌ None

#### Jobs.tsx (Main Jobs Page)
- **Data Source**: Dynamic database query via `fetchJobs()`
- **Type**: Live data from Supabase `jobs` table
- **Fetch Logic** (lines 53-60 in Jobs.tsx):
  ```javascript
  useEffect(() => {
    setLoadingJobs(true);
    fetchJobs().then(data => {
      setJobs(data);
      setLoadingJobs(false);
      // ... handle URL params
    }).catch(() => setLoadingJobs(false));
  }, []);
  ```
- **Update Frequency**: On component mount + event listeners
- **Database Connection**: ✅ Yes

---

### 2. Database Query Details

#### fetchJobs() Function
**Location**: [src/lib/supabaseQueries.ts](src/lib/supabaseQueries.ts#L1-L18)

```javascript
export async function fetchJobs() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .or(`post_paid.eq.true,post_plan.is.null`)
    .or(`post_expires_at.is.null,post_expires_at.gt.${now},grace_ends_at.gt.${now}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
```

**Filters Applied**:
| Filter | Condition | Purpose |
|--------|-----------|---------|
| `is_active` | Must be `true` | Only show active job postings |
| `post_paid` OR `post_plan IS NULL` | Post is paid OR created before billing system | Billing gate: only paid posts or legacy posts |
| `post_expires_at IS NULL` OR `post_expires_at > now` | Never expires OR still valid | Prevent expired one-time posts |
| `grace_ends_at > now` | Still in grace window | Allow recurring posts in grace period |
| Sort | `created_at DESC` | Newest jobs first |

**Key Business Logic**: 
- Implements "defense-in-depth" billing gates (mirrors RLS policy)
- Ensures only confirmed-paid jobs appear
- Handles both legacy (pre-billing) and modern (paid) jobs

---

### 3. Filtering & Selection Logic

#### Home.tsx Featured Jobs
- **Filters**: ❌ None—displays all 4 hardcoded jobs
- **Selection Logic**: Static array display
- **Limit**: 4 jobs (hardcoded)
- **Sorting**: No sorting—fixed order in array
- **Display Code**:
  ```javascript
  <div className="grid sm:grid-cols-2 gap-4 stagger-children stagger-visible">
    {featuredJobs.map((job) => (
      // Render each hardcoded job
    ))}
  </div>
  ```

#### Jobs.tsx Main Page
- **Filters Applied** (lines 90-99):
  1. **Search**: Title, company, or description (case-insensitive)
  2. **Location**: Matches location filter (case-insensitive partial match)
  3. **Job Type**: Exact match on type (Full-time, Part-time, Contract, etc.)
  4. **Category**: Exact match on category
  
- **Selection Logic**:
  ```javascript
  const filteredJobs = jobs.filter(job => {
    const q = search.toLowerCase();
    const matchSearch = !search || job.title.toLowerCase().includes(q) || 
                        job.company.toLowerCase().includes(q) || 
                        (job.description || '').toLowerCase().includes(q);
    const matchLocation = !locationFilter || 
                          job.location.toLowerCase().includes(locationFilter.toLowerCase());
    const matchType = !typeFilter || job.type === typeFilter;
    const matchCategory = !categoryFilter || job.category === categoryFilter;
    return matchSearch && matchLocation && matchType && matchCategory;
  });
  ```

- **Limit**: All matching jobs displayed
- **Sorting**: By `created_at` DESC (newest first)
- **Display Count**: Shows result summary: `"{filteredJobs.length} jobs found"`

---

### 4. Data Flow Diagrams

#### Home.tsx Data Flow
```
Home.tsx Component Mount
    ↓
No fetchJobs() call
    ↓
Read hardcoded featuredJobs array (lines 24-29)
    ↓
Display 4 static job cards
    ↓
No database connection
    ↓
Static display (never updates)
```

#### Jobs.tsx Data Flow
```
Jobs.tsx Component Mount
    ↓
useEffect hook triggers (line 53)
    ↓
Call fetchJobs() from supabaseQueries.ts
    ↓
Supabase Query:
  - SELECT * FROM jobs
  - WHERE is_active = true
  - AND (post_paid = true OR post_plan IS NULL)
  - AND (post_expires_at IS NULL OR post_expires_at > now OR grace_ends_at > now)
  - ORDER BY created_at DESC
    ↓
Store all jobs in state: setJobs(data)
    ↓
Apply user-selected filters:
  - Search (title/company/description)
  - Location
  - Job Type
  - Category
    ↓
filteredJobs array created
    ↓
Display filtered results with pagination/infinite scroll
    ↓
Listen for 'jobs:updated' event to refresh data
```

---

### 5. Key Differences Summary

| Aspect | Home.tsx | Jobs.tsx |
|--------|----------|----------|
| **Data Type** | Hardcoded static | Dynamic from Supabase |
| **Job Count** | 4 (fixed) | All matching jobs |
| **Data Freshness** | Never updates | Real-time |
| **Filters** | None | 4 filters (search, location, type, category) |
| **Sorting** | Fixed order | `created_at DESC` |
| **Matching Algorithm** | N/A | Multi-field search + exact match |
| **User Customization** | No | Yes |
| **Billing Validation** | N/A | ✅ Yes (3 gates) |
| **Expiration Handling** | N/A | ✅ Yes (checks grace period) |
| **View Tracking** | No | ✅ Yes (increments views) |
| **Refresh Logic** | Never | On mount + event listener |

---

## 6. Why Some Jobs Don't Appear on Homepage

### Root Causes

1. **Hardcoded Mock Data** (Primary Reason)
   - The homepage uses fake/example jobs that don't exist in the database
   - These 4 jobs are placeholder data for design purposes only
   - No real jobs from the database are shown on the homepage

2. **Missing Database Integration**
   - `Home.tsx` has NO `fetchJobs()` call
   - There's a separate fetch for "Featured Business Spotlight" ads (different from jobs)
   - But regular jobs are never fetched for the homepage

3. **No Featured Jobs Query**
   - There's no `fetchFeaturedJobs()` function
   - The `is_featured` field exists in the `jobs` table but isn't used on the homepage
   - Jobs marked as featured in the database don't appear anywhere special

4. **Billing Gates Don't Apply**
   - The hardcoded data bypasses all billing/payment validation
   - Real jobs must pass `fetchJobs()` billing gates to appear on Jobs page
   - These safeguards never reach the homepage

### What Jobs DON'T Show on Homepage
- ❌ Unpaid jobs (even if `is_featured = true`)
- ❌ Expired one-time jobs (even if valid on Jobs page)
- ❌ Jobs outside grace period
- ❌ ALL real jobs from database (hardcoded data only)

### What WOULD Show if Fixed
If the homepage used `fetchJobs()`:
- ✅ All active, paid jobs
- ✅ Jobs not yet expired (or in grace period)
- ✅ Legacy jobs (pre-billing system)
- ✅ Dynamically updated as new jobs are posted
- ✅ Most recent 4-6 jobs (after sorting by `created_at DESC`)

---

## 7. Comparison Table: Featured Business Spotlight (Ads) vs Featured Jobs

The homepage DOES have a "Featured Business Spotlight" section (lines 220-245 in Home.tsx) that:
- **Data Source**: `fetchPublicAdvertisements()` from `supabaseQueries`
- **Filters**: 
  - `is_featured = true` OR `package = 'featured'`
  - `payment_status = 'paid'`
- **Sorting**: Featured (is_featured=true) first, then by created_at DESC
- **Display**: Up to 6 ads
- **Status**: ✅ **This IS live and dynamic** (unlike regular featured jobs)

**Key Insight**: The "Featured Business Spotlight" ads work dynamically, but "Featured Jobs" are hardcoded. This is inconsistent design.

---

## 8. Recommendations

### To Fix Homepage Featured Jobs

**Option 1: Use Real Featured Jobs** (Recommended)
```javascript
// In Home.tsx
const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);

useEffect(() => {
  (async () => {
    try {
      const allJobs = await fetchJobs();
      // Show 4 most recent featured jobs, or 4 most recent if none featured
      const featured = allJobs.filter(j => j.is_featured).slice(0, 4);
      setFeaturedJobs(featured.length > 0 ? featured : allJobs.slice(0, 4));
    } catch (e) {
      console.error('Featured jobs failed:', e);
    }
  })();
}, []);
```

**Option 2: Create Specialized Query**
```javascript
// In supabaseQueries.ts
export async function fetchFeaturedJobs(limit = 4) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured", true)
    .or(`post_paid.eq.true,post_plan.is.null`)
    .or(`post_expires_at.is.null,post_expires_at.gt.${now},grace_ends_at.gt.${now}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}
```

**Option 3: Use Featured Business Spotlight Pattern**
- Rename "Featured Jobs" section to something else (e.g., "Hot Opportunities")
- Keep hardcoded data for homepage control
- Update manually as needed for marketing

---

## Conclusion

| Question | Answer |
|----------|--------|
| **Same data source?** | No—Home uses hardcoded, Jobs uses database |
| **Same selection logic?** | No—Home has no logic, Jobs filters 4 ways |
| **Same database query?** | No—Home doesn't query DB for jobs |
| **Why jobs disappear?** | They only appear on Jobs page if they pass `fetchJobs()` billing gates |
| **Why not on homepage?** | Homepage has no integration with job database |
| **Is this intentional?** | Possibly—hardcoded data gives marketing control, but inconsistent with spotlight ads |

