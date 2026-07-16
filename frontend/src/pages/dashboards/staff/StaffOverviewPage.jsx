import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import {

  FiBookOpen,

  FiCalendar,

  FiUserCheck,

  FiUsers,

} from "react-icons/fi";



import { staffApi } from "../../../api/client";

import StaffDataTable from "../../../components/staff/StaffDataTable";

import StaffPageHeader from "../../../components/staff/StaffPageHeader";

import StaffStatCard from "../../../components/staff/StaffStatCard";

import StatusBadge from "../../../components/staff/StatusBadge";

import { formatStatus } from "../../../utils/formatters";



function StaffOverviewPage() {

  const [overview, setOverview] = useState(null);

  const [students, setStudents] = useState([]);

  const [parents, setParents] = useState([]);

  const [classes, setClasses] = useState([]);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    let isMounted = true;



    Promise.all([

      staffApi.getOverview(),

      staffApi.getStudents(),

      staffApi.getParents(),

      staffApi.getClasses(),

    ])

      .then(([overviewRes, studentsRes, parentsRes, classesRes]) => {

        if (!isMounted) return;



        setOverview(overviewRes.data);

        setStudents(studentsRes.data.slice(0, 5));

        setParents(parentsRes.data.slice(0, 5));

        setClasses(classesRes.data.slice(0, 5));

      })

      .catch((err) => {

        if (isMounted) {

          setError(err.message);

        }

      })

      .finally(() => {

        if (isMounted) {

          setLoading(false);

        }

      });



    return () => {

      isMounted = false;

    };

  }, []);



  return (

    <>

      <StaffPageHeader

        title="Staff Dashboard"

        description="Quáº£n lÃ½ nÄƒm há»c, lá»›p há»c, phÃ¢n bá»• há»c sinh vÃ  giÃ¡o viÃªn"

      />



      {error && (

        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">

          {error}

        </div>

      )}



      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <StaffStatCard

          label="NÄƒm há»c hiá»‡n táº¡i"

          value={loading ? "..." : overview?.schoolYearName ?? "â€”"}

          hint={`${overview?.totalSchoolYears ?? 0} nÄƒm há»c trong há»‡ thá»‘ng`}

          icon={FiCalendar}

          accent="orange"

        />

        <StaffStatCard

          label="Lá»›p há»c"

          value={loading ? "..." : overview?.totalClasses ?? 0}

          hint="Lá»›p Ä‘ang hoáº¡t Ä‘á»™ng"

          icon={FiBookOpen}

          accent="blue"

        />

        <StaffStatCard

          label="Tá»•ng há»c sinh"

          value={loading ? "..." : overview?.totalStudents ?? 0}

          hint="Há»c sinh Ä‘ang hoáº¡t Ä‘á»™ng"

          icon={FiUsers}

          accent="peach"

        />

        <StaffStatCard

          label="GiÃ¡o viÃªn"

          value={loading ? "..." : overview?.totalTeachers ?? 0}

          hint={`${overview?.totalParents ?? 0} phá»¥ huynh liÃªn káº¿t`}

          icon={FiUserCheck}

          accent="navy"

        />

      </section>



      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">

        <StaffDataTable

          title="Lá»›p há»c"

          description="Danh sÃ¡ch lá»›p theo nÄƒm há»c hiá»‡n táº¡i"

          showSearch={false}

          searchValue=""

          onSearchChange={() => {}}

          isLoading={loading}

          getRowLink={(row) => `/staff/classes/${row.classId}`}

          columns={[

            { key: "className", label: "Lá»›p" },

            { key: "gradeName", label: "Khá»‘i" },

            { key: "studentCount", label: "HS" },

            { key: "teacherCount", label: "GV" },

          ]}

          rows={classes.map((item) => ({

            ...item,

            id: item.classId,

          }))}

        />



        <StaffDataTable

          title="Há»c sinh má»›i nháº¥t"

          description="Há»“ sÆ¡ há»c sinh trong há»‡ thá»‘ng"

          showSearch={false}

          searchValue=""

          onSearchChange={() => {}}

          isLoading={loading}

          columns={[

            { key: "studentCode", label: "MÃ£ HS" },

            { key: "fullName", label: "Há» tÃªn" },

            { key: "className", label: "Lá»›p" },

            {

              key: "status",

              label: "Tráº¡ng thÃ¡i",

              render: (row) => (

                <StatusBadge

                  value={formatStatus(row.status)}

                  tone="success"

                />

              ),

            },

          ]}

          rows={students.map((item) => ({

            ...item,

            id: item.studentId,

          }))}

        />

      </section>



      <StaffDataTable

        title="Phá»¥ huynh liÃªn káº¿t"

        description="ThÃ´ng tin phá»¥ huynh vÃ  há»c sinh tÆ°Æ¡ng á»©ng"

        showSearch={false}

        searchValue=""

        onSearchChange={() => {}}

        isLoading={loading}

        columns={[

          { key: "fullName", label: "Phá»¥ huynh" },

          { key: "studentName", label: "Há»c sinh" },

          { key: "phone", label: "Äiá»‡n thoáº¡i" },

        ]}

        rows={parents.map((item) => ({

          ...item,

          id: item.parentId,

        }))}

      />



      <div className="mt-6 flex flex-wrap gap-3">

        <Link

          to="/staff/school-years"

          className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"

        >

          Quáº£n lÃ½ nÄƒm há»c

        </Link>

        <Link

          to="/staff/classes"

          className="rounded-xl border border-[#08509F] px-4 py-2.5 text-sm font-semibold text-[#08509F] transition hover:bg-blue-50"

        >

          Quáº£n lÃ½ lá»›p há»c

        </Link>

      </div>

    </>

  );

}



export default StaffOverviewPage;

