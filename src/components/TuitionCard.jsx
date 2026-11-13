const BD_TIMEZONE = 'Asia/Dhaka';

export default function TuitionCard({ tuition }) {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      timeZone: BD_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    const datePart = date.toLocaleDateString('en-US', {
      timeZone: BD_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timePart = date.toLocaleTimeString('en-US', {
      timeZone: BD_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return `${datePart} at ${timePart}`;
  };

  const getFullTimestamp = (dateString) => {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? undefined
      : `${date.toLocaleString('en-US', { timeZone: BD_TIMEZONE })} (BST)`;
  };

  const isUrgent = tuition.isUrgent;
  const isPublished = tuition.isPublish;
  const isCancelled = Boolean(tuition.tuitionCancelReasonPublic?.trim());

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 p-5">
      {/* Header with Code and Badges */}
      <div className="flex justify-between items-start mb-4 pb-3 border-b gap-2">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-blue-700">#{tuition.tuitionCode}</h3>
          <p
            className="text-sm text-gray-500"
            title={getFullTimestamp(tuition.createdAt)}
          >
            Posted: {formatDateTime(tuition.createdAt)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end shrink-0">
          {isCancelled && (
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Cancelled</span>
          )}
          {isPublished ? (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">Published</span>
          ) : (
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-semibold">Draft</span>
          )}
          {isUrgent && (
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Urgent</span>
          )}
        </div>
      </div>

      {/* Cancellation Reason Banner */}
      {isCancelled && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">
            Tuition Cancel Reason
          </p>
          <p className="text-xs sm:text-sm text-red-900 font-medium whitespace-pre-line break-words">
            {tuition.tuitionCancelReasonPublic.trim()}
          </p>
        </div>
      )}

      {/* Student & Class Info */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-50 p-2 rounded">
          <p className="text-xs text-gray-600">Class</p>
          <p className="font-semibold text-gray-800">{tuition.class || 'N/A'}</p>
        </div>
        <div className="bg-purple-50 p-2 rounded">
          <p className="text-xs text-gray-600">Student(s)</p>
          <p className="font-semibold text-gray-800">{tuition.student || 'N/A'}</p>
        </div>
        <div className="bg-indigo-50 p-2 rounded">
          <p className="text-xs text-gray-600">Medium</p>
          <p className="font-semibold text-gray-800">{tuition.medium || 'N/A'}</p>
        </div>
        <div className="bg-pink-50 p-2 rounded">
          <p className="text-xs text-gray-600">Institute</p>
          <p className="font-semibold text-gray-800 text-sm">{tuition.institute || '-'}</p>
        </div>
      </div>

      {/* Subject */}
      <div className="mb-4 p-3 bg-yellow-50 rounded">
        <p className="text-xs text-gray-600">Subject</p>
        <p className="font-semibold text-gray-800">{tuition.subject || 'N/A'}</p>
      </div>

      {/* Teacher & Requirements */}
      <div className="mb-4">
        <h4 className="text-sm font-bold text-gray-700 mb-2">Teacher Requirements</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Wanted:</span>
            <span className="font-semibold">{tuition.wantedTeacher || 'Any'}</span>
          </div>
          <div className="flex justify-between items-start gap-2">
            <span className="text-gray-600 shrink-0">Guardian Demand:</span>
            {tuition.guardianDemandForPublic?.trim() ? (
              <span className="font-semibold text-right text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-xs sm:text-sm break-words">
                {tuition.guardianDemandForPublic.trim()}
              </span>
            ) : (
              <span className="font-semibold text-gray-400">N/A</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Contact:</span>
            <span className="font-semibold">{tuition.tutorNumber ? tuition.tutorNumber : 'Not provided'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">WhatsApp Apply:</span>
            <span className={tuition.isWhatsappApply ? 'text-green-600 font-semibold' : 'text-gray-500'}>
              {tuition.isWhatsappApply ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Schedule & Salary */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="bg-green-50 p-3 rounded">
          <p className="text-xs text-gray-600">Time</p>
          <p className="font-semibold text-gray-800">{tuition.time || 'N/A'}</p>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <p className="text-xs text-gray-600">Days/Week</p>
          <p className="font-semibold text-gray-800">{tuition.day || 'N/A'}</p>
        </div>
        <div className="col-span-2 bg-orange-100 p-3 rounded border-2 border-orange-300">
          <p className="text-xs text-gray-600">Salary</p>
          <p className="font-bold text-orange-700 text-lg">৳ {tuition.salary || 'N/A'}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-600">Joining</p>
          <p className="font-semibold text-gray-800">{tuition.joining || 'N/A'}</p>
        </div>
      </div>

      {/* Location */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <h4 className="text-sm font-bold text-gray-700 mb-2">Location</h4>
        <div className="space-y-1 text-sm">
          <p><span className="text-gray-600">Address:</span> {tuition.location || 'N/A'}</p>
          <p><span className="text-gray-600">Area:</span> {tuition.area || 'N/A'}</p>
          <p><span className="text-gray-600">City:</span> {tuition.city || 'N/A'}</p>
        </div>
      </div>

      {/* Notes & Comments */}
      {(tuition.note || tuition.comment1 || tuition.comment2) && (
        <div className="mb-4 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
          <h4 className="text-sm font-bold text-gray-700 mb-2">Notes & Comments</h4>
          <div className="space-y-2 text-xs text-gray-700">
            {tuition.note && (
              <div>
                <p className="font-semibold text-blue-900">Note:</p>
                <p className="italic">{tuition.note}</p>
              </div>
            )}
            {tuition.comment1 && (
              <div>
                <p className="font-semibold text-blue-900">Comment 1:</p>
                <p className="italic">{tuition.comment1}</p>
              </div>
            )}
            {tuition.comment2 && (
              <div>
                <p className="font-semibold text-blue-900">Comment 2:</p>
                <p className="italic">{tuition.comment2}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status & Updates */}
      <div className="mb-4 p-3 bg-purple-50 rounded">
        <h4 className="text-sm font-bold text-gray-700 mb-2">Status & Updates</h4>
        <div className="space-y-1 text-xs text-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-600">Last Check:</span>
            <span>{formatDate(tuition.lastAvailableCheck)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Last Update:</span>
            <span>{formatDate(tuition.lastUpdate)}</span>
          </div>
          {tuition.lastUpdateComment && (
            <div className="col-span-2 mt-2 pt-2 border-t border-purple-200">
              <p className="font-semibold">Last Update Comment:</p>
              <p className="italic">{tuition.lastUpdateComment}</p>
            </div>
          )}
          <div className="flex justify-between mt-2">
            <span className="text-gray-600">Next Update:</span>
            <span className="font-semibold">{formatDate(tuition.nextUpdateDate)}</span>
          </div>
          {tuition.nextUpdateComment && (
            <div className="mt-2 pt-2 border-t border-purple-200">
              <p className="font-semibold">Next Update Plan:</p>
              <p className="italic">{tuition.nextUpdateComment}</p>
            </div>
          )}
          <div className="flex justify-between items-start gap-2 pt-2 border-t border-purple-200">
            <span className="text-gray-600 shrink-0">Cancel Reason:</span>
            {isCancelled ? (
              <span className="font-semibold text-right text-red-700 break-words">
                {tuition.tuitionCancelReasonPublic.trim()}
              </span>
            ) : (
              <span className="text-gray-400 font-semibold">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Admin Info */}
      <div className="pt-3 border-t text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Created by:</span>
          <span className="font-semibold">{tuition.createdBy || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Updated by:</span>
          <span className="font-semibold">{tuition.updatedBy || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>Last modified:</span>
          <span>{formatDate(tuition.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
