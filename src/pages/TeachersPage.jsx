import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  RotateCw,
  Download,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import TeacherCard from '../components/TeacherCard';
import TeacherModal from '../components/TeacherModal';
import { CardGridSkeleton, Skeleton } from '../components/Skeletons';
import {
  getCachedTeachers,
  fetchAndSyncAllTeachers,
  abortOngoingSync,
} from '../services/teacherStorage';
import { exportTeachersToCSV, exportTeachersToJSON } from '../utils/exportTeachers';

const INITIAL_RENDER_COUNT = 24;
const BATCH_INCREMENT = 24;
const FILTER_INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-100';

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({
    loaded: 0,
    total: 0,
    percent: 0,
    page: 1,
    totalPages: 1,
  });
  const [syncError, setSyncError] = useState(null);

  // Selected teacher for full details modal
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedUniversity, setSelectedUniversity] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  // Infinite scroll display count
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Observer sentinel ref
  const observerTarget = useRef(null);

  // Sync data from API
  const triggerSync = useCallback(async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      setSyncError(null);
      setSyncProgress({ loaded: 0, total: 0, percent: 0, page: 1, totalPages: 1 });

      const allData = await fetchAndSyncAllTeachers((progress) => {
        setSyncProgress(progress);
      });

      setTeachers(allData);
      setLastUpdated(new Date());
      setVisibleCount(INITIAL_RENDER_COUNT);
    } catch (err) {
      console.error('Failed to sync teachers:', err);
      setSyncError(err.message || 'Failed to download teacher data from API.');
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // Load from IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      try {
        setLoading(true);
        const cached = await getCachedTeachers();
        if (!isMounted) return;

        if (cached && cached.teachers && cached.teachers.length > 0) {
          setTeachers(cached.teachers);
          setLastUpdated(cached.lastUpdated);
          setLoading(false);
        } else {
          // If no cache exists, trigger sync automatically
          setLoading(false);
          triggerSync();
        }
      } catch (err) {
        console.error('Error reading cache:', err);
        setLoading(false);
      }
    }

    loadInitial();

    return () => {
      isMounted = false;
      abortOngoingSync();
    };
  }, [triggerSync]);

  // Close export menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derive unique options for filter dropdowns
  const { areaOptions, universityOptions, yearOptions } = useMemo(() => {
    const areaMap = new Map();
    const uniMap = new Map();
    const yearMap = new Map();

    for (const t of teachers) {
      if (t.currentArea) {
        const a = t.currentArea.trim();
        if (a) areaMap.set(a, (areaMap.get(a) || 0) + 1);
      }
      if (t.honorsUniversity) {
        const u = t.honorsUniversity.trim();
        if (u) uniMap.set(u, (uniMap.get(u) || 0) + 1);
      }
      if (t.academicYear) {
        const y = t.academicYear.trim();
        if (y) yearMap.set(y, (yearMap.get(y) || 0) + 1);
      }
    }

    const sortFn = (a, b) => b[1] - a[1];

    return {
      areaOptions: Array.from(areaMap.entries()).sort(sortFn),
      universityOptions: Array.from(uniMap.entries()).sort(sortFn).slice(0, 100),
      yearOptions: Array.from(yearMap.entries()).sort(sortFn),
    };
  }, [teachers]);

  // Filter teachers based on active controls
  const filteredTeachers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return teachers.filter((teacher) => {
      // Search query across multiple fields
      if (query) {
        const name = teacher.name?.toLowerCase() || '';
        const area = teacher.currentArea?.toLowerCase() || '';
        const dept = teacher.honorsDept?.toLowerCase() || '';
        const uni = teacher.honorsUniversity?.toLowerCase() || '';
        const mastersDept = teacher.mastersDept?.toLowerCase() || '';
        const mastersUni = teacher.mastersUniversity?.toLowerCase() || '';
        const subject = teacher.favoriteSubject?.toLowerCase() || '';
        const college = teacher.college?.toLowerCase() || '';
        const school = teacher.school?.toLowerCase() || '';
        const premiumCode = teacher.premiumCode?.toLowerCase() || '';
        const uniCode = teacher.uniCode?.toLowerCase() || '';

        const matches =
          name.includes(query) ||
          area.includes(query) ||
          dept.includes(query) ||
          uni.includes(query) ||
          mastersDept.includes(query) ||
          mastersUni.includes(query) ||
          subject.includes(query) ||
          college.includes(query) ||
          school.includes(query) ||
          premiumCode.includes(query) ||
          uniCode.includes(query);

        if (!matches) return false;
      }

      // Gender filter
      if (genderFilter !== 'all') {
        const g = teacher.gender?.toLowerCase();
        if (g !== genderFilter) return false;
      }

      // Area filter
      if (selectedArea !== 'all') {
        if (teacher.currentArea?.trim() !== selectedArea) return false;
      }

      // University filter
      if (selectedUniversity !== 'all') {
        if (teacher.honorsUniversity?.trim() !== selectedUniversity) return false;
      }

      // Academic Year filter
      if (selectedYear !== 'all') {
        if (teacher.academicYear?.trim() !== selectedYear) return false;
      }

      return true;
    });
  }, [teachers, searchQuery, genderFilter, selectedArea, selectedUniversity, selectedYear]);

  // Reset infinite scroll whenever filters change
  useEffect(() => {
    setVisibleCount(INITIAL_RENDER_COUNT);
  }, [searchQuery, genderFilter, selectedArea, selectedUniversity, selectedYear]);

  // Load more handler
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_INCREMENT, filteredTeachers.length));
  }, [filteredTeachers.length]);

  // IntersectionObserver for seamless infinite scrolling
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredTeachers.length) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, visibleCount, filteredTeachers.length]);

  const visibleTeachers = useMemo(() => {
    return filteredTeachers.slice(0, visibleCount);
  }, [filteredTeachers, visibleCount]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setGenderFilter('all');
    setSelectedArea('all');
    setSelectedUniversity('all');
    setSelectedYear('all');
  };

  const isFiltered =
    Boolean(searchQuery) ||
    genderFilter !== 'all' ||
    selectedArea !== 'all' ||
    selectedUniversity !== 'all' ||
    selectedYear !== 'all';

  const isInitialLoading = loading || (syncing && teachers.length === 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Teachers Directory
          </h1>
          <p className="text-gray-600">
            Explore{' '}
            {isInitialLoading ? (
              <Skeleton as="span" className="inline-block h-4 w-12 align-middle mx-0.5" />
            ) : (
              filteredTeachers.length.toLocaleString()
            )}{' '}
            of{' '}
            {isInitialLoading ? (
              <Skeleton as="span" className="inline-block h-4 w-12 align-middle mx-0.5" />
            ) : (
              teachers.length.toLocaleString()
            )}{' '}
            registered public teachers
          </p>
          <p className="text-sm text-gray-500">
            Complete registry synced with Tuition Seba Forum
          </p>
        </div>

        {/* Sync & Export Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-300 shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            <RotateCw className={`w-4 h-4 text-blue-600 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={teachers.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100">
                  Export {filteredTeachers.length.toLocaleString()} Records
                </div>
                <button
                  onClick={() => {
                    exportTeachersToCSV(
                      filteredTeachers,
                      `teachers_${isFiltered ? 'filtered' : 'all'}_${new Date().toISOString().slice(0, 10)}.csv`
                    );
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <span>Download as CSV</span>
                </button>
                <button
                  onClick={() => {
                    exportTeachersToJSON(
                      filteredTeachers,
                      `teachers_${isFiltered ? 'filtered' : 'all'}_${new Date().toISOString().slice(0, 10)}.json`
                    );
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                >
                  <FileCode className="w-4 h-4 text-amber-600" />
                  <span>Download as JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncing && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex justify-between items-center mb-2 text-sm text-blue-900 font-semibold">
            <span className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-blue-600" />
              {syncProgress.total > 0
                ? `Syncing teachers data... Page ${syncProgress.page} of ${syncProgress.totalPages}`
                : 'Connecting to teachers directory...'}
            </span>
            {syncProgress.total > 0 ? (
              <span>
                {syncProgress.loaded.toLocaleString()} / {syncProgress.total.toLocaleString()} ({syncProgress.percent}%)
              </span>
            ) : (
              <Skeleton as="span" className="inline-block h-4 w-24 bg-blue-200/80" />
            )}
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
            {syncProgress.total > 0 ? (
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${syncProgress.percent}%` }}
              ></div>
            ) : (
              <div className="skeleton-shimmer bg-blue-500/80 h-2.5 rounded-full w-full"></div>
            )}
          </div>
        </div>
      )}

      {/* Sync Error Banner */}
      {syncError && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-red-800">
            <p className="font-bold">Sync Failed</p>
            <p>{syncError}</p>
          </div>
          <button
            onClick={triggerSync}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Controls (matching TuitionsPage layout & styles) */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Search & Filter</h2>
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Cached: {lastUpdated.toLocaleDateString()} {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* Search Term */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search by Name, Area, Dept, Subject, University
            </label>
            <input
              type="text"
              placeholder="e.g., Rahim, Math, Chittagong, CUET, Management..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isInitialLoading}
              className={FILTER_INPUT_CLASS}
            />
          </div>

          {/* Teacher Gender */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Teacher Gender
            </label>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              disabled={isInitialLoading}
              className={FILTER_INPUT_CLASS}
            >
              <option value="all">All</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>

          {/* Area Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Current Area
            </label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              disabled={isInitialLoading}
              className={FILTER_INPUT_CLASS}
            >
              <option value="all">All Areas ({areaOptions.length})</option>
              {areaOptions.map(([area, count]) => (
                <option key={area} value={area}>
                  {area} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* University Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              University / Institute
            </label>
            <select
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              disabled={isInitialLoading}
              className={FILTER_INPUT_CLASS}
            >
              <option value="all">All Universities ({universityOptions.length})</option>
              {universityOptions.map(([uni, count]) => (
                <option key={uni} value={uni}>
                  {uni} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Academic Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={isInitialLoading}
              className={FILTER_INPUT_CLASS}
            >
              <option value="all">All Academic Years</option>
              {yearOptions.map(([year, count]) => (
                <option key={year} value={year}>
                  {year} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={resetAllFilters}
              disabled={!isFiltered || isInitialLoading}
              className="w-full px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          Showing{' '}
          {isInitialLoading ? (
            <Skeleton as="span" className="inline-block h-4 w-10 align-middle mx-0.5" />
          ) : (
            <span className="font-bold text-blue-600">
              {Math.min(visibleCount, filteredTeachers.length).toLocaleString()}
            </span>
          )}{' '}
          of{' '}
          {isInitialLoading ? (
            <Skeleton as="span" className="inline-block h-4 w-12 align-middle mx-0.5" />
          ) : (
            <span className="font-bold text-gray-800">{filteredTeachers.length.toLocaleString()}</span>
          )}{' '}
          results
        </p>
      </div>

      {/* Cards Grid */}
      {isInitialLoading ? (
        <CardGridSkeleton variant="teacher" count={6} />
      ) : visibleTeachers.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTeachers.map((teacher) => (
              <TeacherCard
                key={teacher._id}
                teacher={teacher}
                onSelect={(t) => setSelectedTeacher(t)}
              />
            ))}
          </div>

          {/* Infinite Scroll Trigger Sentinel */}
          <div ref={observerTarget} className="py-8 flex justify-center items-center">
            {visibleCount < filteredTeachers.length ? (
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition text-sm cursor-pointer"
              >
                Load More Teachers ({filteredTeachers.length - visibleCount} remaining)
              </button>
            ) : (
              <p className="text-sm text-gray-500 py-4">
                Showing all {filteredTeachers.length.toLocaleString()} matching teachers
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-700 mb-2">No Results Found</h3>
          <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
          <button
            onClick={resetAllFilters}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Teacher Full Profile Modal */}
      {selectedTeacher && (
        <TeacherModal
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </div>
  );
}
