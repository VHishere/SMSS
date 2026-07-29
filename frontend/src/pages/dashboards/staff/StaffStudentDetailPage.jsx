import { useEffect, useRef, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";



import { staffApi } from "../../../api/client";

import UserAvatar from "../../../components/atoms/UserAvatar";

import StaffDetailCard, { StaffDetailItem } from "../../../components/staff/StaffDetailCard";

import StaffPageHeader from "../../../components/staff/StaffPageHeader";

import {

  formatGender,

  formatRelationship,

  formatStatus,

} from "../../../utils/formatters";



function StaffStudentDetailPage() {

  const { id } = useParams();

  const navigate = useNavigate();

  const [student, setStudent] = useState(null);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);

  const [uploadError, setUploadError] = useState("");

  const fileRef = useRef(null);



  useEffect(() => {

    staffApi

      .getStudent(id)

      .then((res) => setStudent(res.data))

      .catch((err) => setError(err.message))

      .finally(() => setLoading(false));

  }, [id]);



  async function onAvatarChange(event) {

    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {

      setUploadError("Ảnh không hợp lệ (chỉ chấp nhận tệp ảnh).");

      return;

    }

    if (file.size > 5 * 1024 * 1024) {

      setUploadError("Ảnh vượt quá 5MB.");

      return;

    }

    setUploading(true);

    setUploadError("");

    try {

      const res = await staffApi.uploadStudentAvatar(id, file);

      setStudent(res.data);

    } catch (err) {

      setUploadError(err.message);

    } finally {

      setUploading(false);

    }

  }



  if (loading) {

    return <div className="py-10 text-center text-slate-500">Đang tải...</div>;

  }



  if (error || !student) {

    return (

      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">

        {error || "Không tìm thấy học sinh"}

      </div>

    );

  }



  return (

    <>

      <StaffPageHeader

        title={student.fullName}

        action={

          <div className="flex gap-2">

            <button

              type="button"

              onClick={() => navigate(`/staff/students/${id}/edit`)}

              className="rounded-xl bg-[#F27123] px-4 py-2 text-sm font-semibold text-white"

            >

              Chỉnh sửa

            </button>

            <Link

              to="/staff/students"

              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-[#0F2747] no-underline hover:text-[#0F2747]"

            >

              Quay lại

            </Link>

          </div>

        }

      />



      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

        <StaffDetailCard title="Thông tin cá nhân">

          <div className="grid gap-4">

            <div className="flex items-center gap-4">

              <UserAvatar name={student.fullName} src={student.avatar} size="xl" />

              <div>

                <input

                  ref={fileRef}

                  type="file"

                  accept="image/*"

                  className="hidden"

                  onChange={onAvatarChange}

                />

                <button

                  type="button"

                  onClick={() => fileRef.current?.click()}

                  disabled={uploading}

                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-[#0F2747] hover:bg-slate-50 disabled:opacity-50"

                >

                  {uploading ? "Đang tải..." : student.avatar ? "Đổi ảnh" : "Tải ảnh lên"}

                </button>

                <p className="mb-0 mt-1 text-xs text-slate-400">JPG/PNG, tối đa 5MB</p>

                {uploadError && (

                  <p className="mb-0 mt-1 text-xs text-red-600">{uploadError}</p>

                )}

              </div>

            </div>

            <StaffDetailItem label="Họ tên" value={student.fullName} />

            <StaffDetailItem label="Email" value={student.email} />

            <StaffDetailItem label="Điện thoại" value={student.phone} />

            <StaffDetailItem label="Ngày sinh" value={student.dateOfBirth} />

            <StaffDetailItem label="Giới tính" value={formatGender(student.gender)} />

            <StaffDetailItem label="Địa chỉ" value={student.address} />

            <StaffDetailItem

              label="Trạng thái"

              value={formatStatus(student.status)}

            />

          </div>

        </StaffDetailCard>



        <StaffDetailCard title="Thông tin lớp học">

          <div className="grid gap-4">

            <StaffDetailItem label="Lớp" value={student.className} />

            <StaffDetailItem label="Khối" value={student.gradeName} />

            <StaffDetailItem label="Năm học" value={student.schoolYearName} />

          </div>

          {student.className && (

            <Link

              to="/staff/classes"

              className="mt-4 inline-block text-sm font-semibold text-[#0F2747] no-underline hover:text-[#0F2747]"

            >

              Quản lý lớp học

            </Link>

          )}

        </StaffDetailCard>



        <StaffDetailCard title="Phụ huynh liên kết">

          {student.parents?.length ? (

            <div className="space-y-3">

              {student.parents.map((parent) => (

                <Link

                  key={parent.parentId}

                  to={`/staff/parents/${parent.parentId}`}

                  className="block rounded-xl border border-slate-200 bg-white p-3 text-[#0F2747] no-underline transition hover:bg-slate-50 hover:text-[#0F2747]"

                >

                  <p className="mb-1 font-semibold text-[#0F2747]">

                    {parent.fullName}

                  </p>

                  <p className="mb-0 text-xs text-slate-500">

                    {formatRelationship(parent.relationship)} · {parent.phone}

                  </p>

                </Link>

              ))}

            </div>

          ) : (

            <p className="text-sm text-slate-500">Chưa liên kết phụ huynh</p>

          )}

        </StaffDetailCard>

      </div>

    </>

  );

}



export default StaffStudentDetailPage;

