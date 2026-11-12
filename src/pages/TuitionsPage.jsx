import { useState, useMemo, useEffect } from 'react';
import TuitionCard from '../components/TuitionCard';
import { CardGridSkeleton, Skeleton } from '../components/Skeletons';

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

export default function TuitionsPage() {
  const [tuitionData, setTuitionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [salaryMin, setSalaryMin] = useState('6000');
  const [salaryMax, setSalaryMax] = useState('');
  const [teacherPreference, setTeacherPreference] = useState('male');
  const [studentGender, setStudentGender] = useState('female');

  // Fetch data from API
  useEffect(() => {
    const fetchTuitions = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/.netlify/functions/tuitions', {
          credentials: 'include',
        });
        if (response.status === 401) {
          throw new Error('Session expired or unauthorized. Please refresh and log in.');
        }
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        setTuitionData(Array.isArray(data) ? data : data.data || []);
      } catch (err) {
        setError(err.message);
        console.error('Failed to fetch tuitions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTuitions();
  }, []);

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

  // Error state
  if (error) {
    return (
      <div className="py-12 px-4 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center border border-red-200">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Data</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
