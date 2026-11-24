import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react';
import TuitionCard from '../components/TuitionCard';
import { CardGridSkeleton, Skeleton } from '../components/Skeletons';
import { readTuitionCache, writeTuitionCache } from '../services/tuitionStorage';

// Automatic retry schedule for transient upstream failures (3s, 6s, 12s, 24s).
const MAX_AUTO_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 3000;
const RETRY_MAX_DELAY_MS = 30000;

const getDaysPerWeek = (dayValue) => {
  if (!dayValue) return null;
  const match = String(dayValue).match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

const getStudentGenderKind = (studentValue) => {
  if (!studentValue) return 'unknown';
  const text = String(studentValue).toLowerCase();
  const hasFemale = /(?:^|\b|\d)female\b/.test(text);
  const hasMale = /(?:^|\b|\d)male\b/.test(text);
  if (hasFemale && hasMale) return 'mixed';
  if (hasFemale) return 'female';
  if (hasMale) return 'male';
  return 'unknown';
};

const formatCacheAge = (savedAt) => {
  const saved = new Date(savedAt);
  if (Number.isNaN(saved.getTime())) return 'earlier';
  const minutes = Math.round((Date.now() - saved.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

export default function TuitionsPage() {
  const [tuitionData, setTuitionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [cacheSavedAt, setCacheSavedAt] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [salaryMin, setSalaryMin] = useState('6000');
  const [salaryMax, setSalaryMax] = useState('');
  const [teacherPreference, setTeacherPreference] = useState('male');
  const [studentGender, setStudentGender] = useState('female');

  const abortRef = useRef(null);
  const isMountedRef = useRef(true);
  const hasDataRef = useRef(false);
  const retryTimerRef = useRef(null);

  // Fetch data from API, keeping the last good snapshot on screen if it fails.
  const fetchTuitions = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (hasDataRef.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await fetch('/.netlify/functions/tuitions', {
        credentials: 'include',
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        const authErr = new Error('Session expired or unauthorized. Please refresh and log in.');
        authErr.fatal = true;
        throw authErr;
      }

      if (!response.ok) {
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          // Upstream returned HTML or an empty body; fall back to the status code.
        }
        const httpErr = new Error(
          payload?.error || `The data service responded with ${response.status}.`
        );
        httpErr.code = payload?.code || 'HTTP_ERROR';
        httpErr.status = response.status;
        throw httpErr;
      }

      const data = await response.json();
      if (controller.signal.aborted || !isMountedRef.current) return;

      const list = Array.isArray(data) ? data : data.data || [];
      hasDataRef.current = true;
      setTuitionData(list);
      setError(null);
      setCacheSavedAt(null);
      setRetryAttempt(0);
      writeTuitionCache(list);
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      if (!isMountedRef.current) return;

      console.error('Failed to fetch tuitions:', err);
      setError({
        message: err.message,
        code: err.code || 'NETWORK_ERROR',
        fatal: Boolean(err.fatal),
      });

      // Only transient failures are worth retrying; auth failures need a re-login.
      if (!err.fatal) {
        setRetryAttempt((attempt) => attempt + 1);
      }
    } finally {
      // A superseded request (aborted by a newer retry or unmount) must not
      // clear the loading state of the request that replaced it.
      if (isMountedRef.current && abortRef.current === controller) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Seed from the last successful snapshot, then revalidate in the background.
  useEffect(() => {
    isMountedRef.current = true;

    const cached = readTuitionCache();
    if (cached) {
      hasDataRef.current = true;
      setTuitionData(cached.tuitions);
      setCacheSavedAt(cached.savedAt);
      setLoading(false);
    }

    fetchTuitions();

    return () => {
      isMountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      abortRef.current?.abort();
    };
  }, [fetchTuitions]);

  // Exponential backoff while the upstream stays down.
  useEffect(() => {
    if (!error || error.fatal) return;
    if (retryAttempt === 0 || retryAttempt > MAX_AUTO_RETRIES) return;

    const delay = Math.min(
      RETRY_BASE_DELAY_MS * 2 ** (retryAttempt - 1),
      RETRY_MAX_DELAY_MS
    );
    retryTimerRef.current = setTimeout(fetchTuitions, delay);

    return () => clearTimeout(retryTimerRef.current);
  }, [error, retryAttempt, fetchTuitions]);

  const retriesExhausted = retryAttempt > MAX_AUTO_RETRIES;
  const isStale = Boolean(error) && tuitionData.length > 0;

  // A manual retry restarts the backoff cycle instead of waiting out the pause.
  const retryNow = useCallback(() => {
    setRetryAttempt(0);
    fetchTuitions();
  }, [fetchTuitions]);

  // Extract min/max salary for reference
  const salaryValues = tuitionData
    .map((t) => {
      const match = t.salary?.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const minSalary = 6000;
  const maxSalary = Math.max(minSalary, salaryValues[salaryValues.length - 1] || 50000);

  // Filter logic
  const filteredData = useMemo(() => {
    return tuitionData.filter((tuition) => {
      // Search term filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        tuition.class?.toLowerCase().includes(searchLower) ||
        tuition.subject?.toLowerCase().includes(searchLower) ||
        tuition.city?.toLowerCase().includes(searchLower) ||
        tuition.area?.toLowerCase().includes(searchLower) ||
        tuition.guardianDemandForPublic?.toLowerCase().includes(searchLower) ||
        tuition.tuitionCancelReasonPublic?.toLowerCase().includes(searchLower) ||
        tuition.tuitionCode?.includes(searchTerm);

      // Teacher preference filter
      const wantedTeacher = tuition.wantedTeacher || '';
      const hasMale = /\bmale\b/i.test(wantedTeacher);
      const hasFemale = /\bfemale\b/i.test(wantedTeacher);
      const matchesTeacher =
        teacherPreference === 'all' ||
        (teacherPreference === 'male' && hasMale) ||
        (teacherPreference === 'female' && hasFemale);

      // Student gender filter
      const studentKind = getStudentGenderKind(tuition.student);
      const matchesStudentGender =
        studentGender === 'all' || studentKind === studentGender;

      // Salary range filter
      const salaryMatch = tuition.salary?.match(/\d+/);
      const tuitionSalary = salaryMatch ? parseInt(salaryMatch[0]) : 0;
      const minSalaryNum = salaryMin ? parseInt(salaryMin) : minSalary;
      const maxSalaryNum = salaryMax ? parseInt(salaryMax) : maxSalary;
      const matchesSalary =
        tuitionSalary >= minSalaryNum && tuitionSalary <= maxSalaryNum;

      const matchesDays = getDaysPerWeek(tuition.day) === 3;

      return (
        matchesSearch &&
        matchesTeacher &&
        matchesStudentGender &&
        matchesSalary &&
        matchesDays
      );
    });
  }, [
    tuitionData,
    searchTerm,
    salaryMin,
    salaryMax,
    teacherPreference,
    studentGender,
    minSalary,
    maxSalary,
  ]);

  const resetFilters = () => {
    setSearchTerm('');
    setSalaryMin('6000');
    setSalaryMax('');
    setTeacherPreference('male');
    setStudentGender('female');
  };

  // Error state (no snapshot to fall back on)
  if (error && tuitionData.length === 0) {
    return (
      <div className="py-12 px-4 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center border border-amber-200">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <WifiOff className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {error.fatal ? 'Session Expired' : 'Data Temporarily Unavailable'}
          </h2>
          <p className="text-gray-700 mb-2">{error.message}</p>
          <p className="text-sm text-gray-500 mb-6">
            {error.fatal
              ? 'Refresh the page and log in again to continue.'
              : retriesExhausted
                ? 'We retried automatically and the service is still down. Nothing is wrong on your side.'
                : 'Retrying automatically — you can also retry right now.'}
          </p>
          <button
            onClick={retryNow}
            disabled={refreshing}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {refreshing ? 'Retrying…' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Stale snapshot banner */}
      {isStale && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-900">
            <p className="font-bold">Showing saved data</p>
            <p>
              The live tuition service is unavailable right now, so you are seeing the last
              snapshot{cacheSavedAt ? ` from ${formatCacheAge(cacheSavedAt)}` : ''}.
              {retriesExhausted
                ? ' Automatic retries have paused.'
                : ' Retrying automatically…'}
            </p>
          </div>
          <button
            onClick={retryNow}
            disabled={refreshing}
            className="px-3 py-1 bg-amber-600 text-white rounded text-xs font-semibold hover:bg-amber-700 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {refreshing ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-2">
          Available Tuitions
        </h1>
        <p className="text-gray-600">
          Explore{' '}
          {loading ? (
            <Skeleton as="span" className="inline-block h-4 w-8 align-middle mx-0.5" />
          ) : (
            filteredData.length
          )}{' '}
          of{' '}
          {loading ? (
            <Skeleton as="span" className="inline-block h-4 w-10 align-middle mx-0.5" />
          ) : (
            tuitionData.length
          )}{' '}
          available tuition opportunities
        </p>
        <p className="text-sm text-gray-500 mt-1">Showing tuitions with 3 days/week</p>
        {refreshing && (
          <p className="text-sm text-blue-600 mt-1 flex items-center gap-2">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            Updating live data…
          </p>
        )}
      </div>

      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-xs p-6 mb-8 border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Search & Filter</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Search Term */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search by Class, Subject, City, Area, Demand
            </label>
            <input
              type="text"
              placeholder="e.g., Class 4, English, CUET, Chittagong..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100"
            />
          </div>

          {/* Teacher Preference */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Teacher Preference
            </label>
            <select
              value={teacherPreference}
              onChange={(e) => setTeacherPreference(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="all">All</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>

          {/* Student Gender */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Student Gender
            </label>
            <select
              value={studentGender}
              onChange={(e) => setStudentGender(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              <option value="all">All</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
        </div>

        {/* Salary Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Minimum Salary (৳)
            </label>
            <input
              type="number"
              min={6000}
              placeholder={`Min (${minSalary})`}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Maximum Salary (৳)
            </label>
            <input
              type="number"
              placeholder={`Max (${maxSalary})`}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              disabled={loading}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Showing{' '}
          {loading ? (
            <Skeleton as="span" className="inline-block h-4 w-8 align-middle mx-0.5" />
          ) : (
            <span className="font-bold text-blue-600">{filteredData.length}</span>
          )}{' '}
          results
        </p>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <CardGridSkeleton variant="tuition" count={6} />
      ) : filteredData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((tuition) => (
            <TuitionCard key={tuition._id} tuition={tuition} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs p-12 text-center border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-700 mb-2">No Results Found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
          <button
            onClick={resetFilters}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}
