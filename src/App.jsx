import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import "./Auth.css";

const API = "http://localhost:8089/api";

const sections = [
  { id: "dashboard", label: "Vue d’ensemble", icon: "◈" },
  { id: "teachers", label: "Enseignants", icon: "♙" },
  { id: "subjects", label: "Matières", icon: "▤" },
  { id: "assignments", label: "Affectations", icon: "↗" },
  { id: "formations", label: "Formations", icon: "⌘" },
  { id: "departments", label: "Départements", icon: "⌂" },
];

const emptyForms = {
  departments: { name: "", description: "" },
  formations: { name: "", description: "" },
  teachers: {
    firstName: "",
    lastName: "",
    email: "",
    grade: "",
    departmentId: "",
  },
  subjects: {
    name: "",
    code: "",
    description: "",
    formationId: "",
  },
  assignments: {
    teacherId: "",
    subjectId: "",
    semester: "S1",
    academicYear: "2026-2027",
    teachingHours: "",
  },
};

const sectionInfo = {
  teachers: {
    title: "Enseignants",
    subtitle: "Consultez les profils et ajoutez les enseignants de l’établissement.",
    endpoint: "/teachers",
    action: "Ajouter un enseignant",
  },
  subjects: {
    title: "Matières",
    subtitle: "Organisez les matières et rattachez-les à leur formation.",
    endpoint: "/subjects",
    action: "Ajouter une matière",
  },
  assignments: {
    title: "Affectations",
    subtitle: "Suivez les enseignants, les matières et les volumes horaires.",
    endpoint: "/assignments",
    action: "Créer une affectation",
  },
  formations: {
    title: "Formations",
    subtitle: "Consultez les formations proposées par l’établissement.",
    endpoint: "/formations",
    action: "Ajouter une formation",
  },
  departments: {
    title: "Départements",
    subtitle: "Gérez les départements auxquels appartiennent les enseignants.",
    endpoint: "/departments",
    action: "Ajouter un département",
  },
};

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const responseText = await response.text();
  let body = null;

  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch {
      body = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null
        ? body.message || body.error || `Erreur HTTP ${response.status}`
        : body || `Erreur HTTP ${response.status}`;

    throw new Error(message);
  }

  return body;
}

function displayName(person) {
  if (!person) return "—";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "—";
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);


  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    const form = new FormData(event.currentTarget);
    try {
      const account = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      setUser(account);
    } catch (error) {
      setLoginError(error.message || "Connexion impossible. Vérifie tes identifiants.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn("La déconnexion serveur a échoué", error);
    }
    setUser(null);
  }

  if (checkingSession) return <div className="auth-loading"><span className="spinner" />Vérification de la session…</div>;
  if (!user) return <LoginScreen onSubmit={handleLogin} error={loginError} loading={loggingIn} />;
  return <AuthenticatedApp user={user} onLogout={handleLogout} />;
}

function LoginScreen({ onSubmit, error, loading }) {
  return (
    <main className="login-page">
      <section className="login-art">
        <div className="login-art-mark">S</div>
        <div className="login-art-copy">
          <div className="eyebrow light">GESTION UNIVERSITAIRE</div>
          <h1>La pédagogie,<br />en harmonie.</h1>
          <p>Un espace clair pour organiser les équipes, les matières et les enseignements.</p>
        </div>
        <span className="login-art-footer">SOAPROJECT · 2026—2027</span>
      </section>
      <section className="login-side">
        <div className="login-brand"><span className="login-brand-mark">S</span><span><strong>Soaproject</strong><small>Portail de gestion</small></span></div>
        <form className="login-form" onSubmit={onSubmit}>
          <div className="eyebrow">BON RETOUR</div>
          <h2>Connectez-vous</h2>
          <p className="login-description">Accédez à votre espace de travail sécurisé.</p>
          <label className="login-field"><span>Adresse e-mail</span><input type="email" name="email" autoComplete="username" placeholder="nom@etablissement.tn" required /></label>
          <label className="login-field"><span>Mot de passe</span><input type="password" name="password" autoComplete="current-password" placeholder="Votre mot de passe" required /></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}<span>→</span></button>
          <div className="login-security">◇ Connexion sécurisée par votre établissement</div>
        </form>
        <footer className="login-footer">© 2026 Soaproject · Gestion pédagogique</footer>
      </section>
    </main>
  );
}

function AuthenticatedApp({ user, onLogout }) {
  const [activePage, setActivePage] = useState("dashboard");
  const [data, setData] = useState({
    departments: [],
    formations: [],
    teachers: [],
    subjects: [],
    assignments: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (user.role === "ENSEIGNANT") {
      // No teacher-scoped endpoints exist yet; do not request management data.
      setData({ departments: [], formations: [], teachers: [], subjects: [], assignments: [] });
      setLoadError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");

    const resources = [
      ["departments", "/departments"],
      ["formations", "/formations"],
      ["teachers", "/teachers"],
      ["subjects", "/subjects"],
      ["assignments", "/assignments"],
    ];

    const results = await Promise.allSettled(
      resources.map(([, path]) => apiRequest(path)),
    );

    const nextData = {};
    const failures = [];

    results.forEach((result, index) => {
      const [key, path] = resources[index];

      if (result.status === "fulfilled") {
        nextData[key] = Array.isArray(result.value) ? result.value : [];
      } else {
        nextData[key] = [];
        failures.push(`${path}: ${result.reason.message}`);
      }
    });

    setData(nextData);
    setLoading(false);

    if (failures.length) {
      setLoadError(
        `Certaines données n’ont pas pu être chargées. Vérifie que le backend est lancé et que les routes existent. ${failures.join(" · ")}`,
      );
    }
  }, [user.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSearch("");
    setFormOpen(false);
  }, [activePage]);

  const role = user.role || "ADMIN";
  const visibleSections = role === "RESPONSABLE"
    ? sections.filter((section) => ["dashboard", "teachers", "subjects", "assignments"].includes(section.id))
    : role === "ENSEIGNANT"
      ? sections.filter((section) => section.id === "dashboard")
      : sections;
  const currentInfo = sectionInfo[activePage];
  const filteredRows = useMemo(() => {
    if (!currentInfo) return [];

    const rows = data[activePage] || [];
    const query = search.trim().toLocaleLowerCase("fr");

    if (!query) return rows;

    return rows.filter((row) => {
      const text = rowSearchText(activePage, row);
      return text.toLocaleLowerCase("fr").includes(query);
    });
  }, [activePage, currentInfo, data, search]);

  function openForm() {
    setEditingTeacherId(null);
    setEditingSubjectId(null);
    setFormValues({ ...emptyForms[activePage] });
    setFormOpen(true);
    setNotice(null);
  }

  function editTeacher(teacher) {
    setEditingSubjectId(null);
    setEditingTeacherId(teacher.id);
    setFormValues({
      firstName: teacher.firstName || "",
      lastName: teacher.lastName || "",
      email: teacher.email || "",
      grade: teacher.grade || "",
      departmentId: teacher.department?.id ? String(teacher.department.id) : "",
    });
    setFormOpen(true);
    setNotice(null);
  }

  function editSubject(subject) {
    setEditingTeacherId(null);
    setEditingSubjectId(subject.id);
    setFormValues({
      name: subject.name || "",
      code: subject.code || "",
      description: subject.description || "",
      formationId: subject.formation?.id ? String(subject.formation.id) : "",
    });
    setFormOpen(true);
    setNotice(null);
  }

  async function toggleSubjectStatus(subject) {
    const operation = subject.isActive === false ? "activate" : "deactivate";
    const action = subject.isActive === false ? "Réactiver" : "Désactiver";
    if (!window.confirm(`${action} la matière « ${subject.name} » ?`)) return;

    try {
      await apiRequest(`/subjects/${subject.id}/${operation}`, { method: "PATCH" });
      setNotice({
        type: "success",
        text: subject.isActive === false ? "Matière réactivée." : "Matière désactivée.",
      });
      await loadData();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  }

  async function toggleTeacherStatus(teacher) {
    const operation = teacher.isActive === false ? "activate" : "deactivate";
    const confirmation = teacher.isActive === false
      ? `Réactiver ${displayName(teacher)} ?`
      : `Désactiver ${displayName(teacher)} ?`;
    if (!window.confirm(confirmation)) return;

    try {
      await apiRequest(`/teachers/${teacher.id}/${operation}`, { method: "PATCH" });
      setNotice({
        type: "success",
        text: teacher.isActive === false ? "Enseignant réactivé." : "Enseignant désactivé.",
      });
      await loadData();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    }
  }

  function updateForm(field, value) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      const payload = { ...formValues };

      if (activePage === "teachers") {
        payload.departmentId = Number(payload.departmentId);
      }
      if (activePage === "subjects") {
        payload.formationId = Number(payload.formationId);
      }
      if (activePage === "assignments") {
        payload.teacherId = Number(payload.teacherId);
        payload.subjectId = Number(payload.subjectId);
        payload.teachingHours = Number(payload.teachingHours);
      }

      const editingTeacher = activePage === "teachers" && editingTeacherId !== null;
      const editingSubject = activePage === "subjects" && editingSubjectId !== null;
      const recordId = editingTeacher ? editingTeacherId : editingSubjectId;
      const isEditing = editingTeacher || editingSubject;
      await apiRequest(
        isEditing ? `${currentInfo.endpoint}/${recordId}` : currentInfo.endpoint,
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      setFormOpen(false);
      setEditingTeacherId(null);
      setEditingSubjectId(null);
      setNotice({ type: "success", text: "Enregistrement effectué avec succès." });
      await loadData();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }

  const totalHours = data.assignments.reduce(
    (total, assignment) => total + Number(assignment.teachingHours || 0),
    0,
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#accueil"
          onClick={(event) => {
            event.preventDefault();
            setActivePage("dashboard");
          }}
        >
          <span className="brand-mark">S</span>
          <span>
            <strong>Soaproject</strong>
            <small>Gestion universitaire</small>
          </span>
        </a>

        <div className="side-caption">{role === "ADMIN" ? "ESPACE ADMINISTRATEUR" : "ESPACE PÉDAGOGIQUE"}</div>
        <nav className="side-nav" aria-label="Navigation principale">
          {visibleSections.map((section) => (
            <button
              key={section.id}
              className={`side-link ${activePage === section.id ? "selected" : ""}`}
              onClick={() => setActivePage(section.id)}
            >
              <span className="side-link-icon">{section.icon}</span>
              <span>{section.label}</span>
              {activePage === section.id && <span className="side-active-mark" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="year-card">
            <span className="year-indicator" />
            <span>
              <small>Année universitaire</small>
              <strong>2026 — 2027</strong>
            </span>
          </div>
          <div className="sidebar-signature">
            <span className="signature-line" />
            <span>Un établissement, une vision.</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-context">
            <span>SOAPROJECT</span>
            <span className="crumb-slash">/</span>
            <strong>
              {role === "ENSEIGNANT" ? "Espace enseignant" : sections.find((section) => section.id === activePage)?.label}
            </strong>
          </div>
          <div className="connection-state">
            <span className="connection-dot" />
            {user.role === "ADMIN" ? "Administrateur" : user.role === "RESPONSABLE" ? "Responsable pédagogique" : "Enseignant"}
            <span className="connection-port">· {user.email}</span>
            <button className="auth-logout" onClick={onLogout}>Déconnexion</button>
          </div>
        </header>

        <div className="content">
          {notice && (
            <div className={`notice ${notice.type}`} role="status">
              <span>{notice.type === "success" ? "✓" : "!"}</span>
              {notice.text}
              <button onClick={() => setNotice(null)} aria-label="Fermer">
                ×
              </button>
            </div>
          )}

          {loadError && (
            <div className="notice error load-notice" role="alert">
              <span>!</span>
              <div>
                <strong>Chargement partiel</strong>
                <p>{loadError}</p>
              </div>
              <button onClick={loadData}>Réessayer</button>
            </div>
          )}

          {role === "ENSEIGNANT" ? (
            <TeacherPortal />
          ) : activePage === "dashboard" ? (
            <Dashboard
              data={data}
              loading={loading}
              totalHours={totalHours}
              onNavigate={setActivePage}
            />
          ) : (
            <section className="resource-page">
              <div className="page-heading">
                <div>
                  <div className="eyebrow">GESTION PÉDAGOGIQUE</div>
                  <h1>{currentInfo.title}</h1>
                  <p>{currentInfo.subtitle}</p>
                </div>
                {(role === "ADMIN" || (role === "RESPONSABLE" && activePage === "assignments")) && (
                  <button className="primary-button" onClick={openForm}>
                    <span>＋</span> {currentInfo.action}
                  </button>
                )}
              </div>

              <div className="resource-toolbar">
                <label className="search-field">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={`Rechercher dans ${currentInfo.title.toLocaleLowerCase("fr")}…`}
                  />
                </label>
                <button className="quiet-button" onClick={loadData}>
                  ↻ <span>Actualiser</span>
                </button>
                <span className="result-count">
                  {filteredRows.length} résultat{filteredRows.length > 1 ? "s" : ""}
                </span>
              </div>

              {formOpen && (role === "ADMIN" || (role === "RESPONSABLE" && activePage === "assignments")) && (
                <EntryForm
                  page={activePage}
                  values={formValues}
                  data={data}
                  saving={saving}
                  onChange={updateForm}
                  onSubmit={submitForm}
                  onCancel={() => { setFormOpen(false); setEditingTeacherId(null); setEditingSubjectId(null); }}
                  title={editingTeacherId ? "Modifier un enseignant" : editingSubjectId ? "Modifier une matière" : undefined}
                />
              )}

              {loading ? (
                <div className="loading-card">
                  <span className="spinner" />
                  Chargement des données…
                </div>
              ) : (
                <DataTable
                  page={activePage}
                  rows={filteredRows}
                  onCreate={openForm}
                  canManage={role === "ADMIN"}
                  canCreate={role === "ADMIN" || (role === "RESPONSABLE" && activePage === "assignments")}
                  onEditTeacher={editTeacher}
                  onToggleTeacherStatus={toggleTeacherStatus}
                  onEditSubject={editSubject}
                  onToggleSubjectStatus={toggleSubjectStatus}
                />
              )}
            </section>
          )}

          <footer className="app-footer">
            <span>SOAPROJECT <i>·</i> Gestion des enseignants et des matières</span>
            <span>Interface connectée à votre base de données</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function TeacherPortal() {
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [summary, setSummary] = useState({ assignmentCount: 0, totalTeachingHours: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      apiRequest("/teacher/me"),
      apiRequest("/teacher/me/assignments"),
      apiRequest("/teacher/me/summary"),
    ])
      .then(([profileResult, assignmentsResult, summaryResult]) => {
        if (!active) return;
        setProfile(profileResult);
        setAssignments(Array.isArray(assignmentsResult) ? assignmentsResult : []);
        setSummary(summaryResult || { assignmentCount: 0, totalTeachingHours: 0 });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Impossible de charger votre espace.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [reloadKey]);

  return (
    <section className="teacher-portal">
      <div className="teacher-portal-heading">
        <div>
          <div className="eyebrow">ESPACE ENSEIGNANT</div>
          <h1>Bonjour{profile?.firstName ? `, ${profile.firstName}` : ""}</h1>
          <p>Retrouvez votre profil et les enseignements qui vous sont affectés.</p>
        </div>
        <button className="quiet-button" onClick={() => setReloadKey((value) => value + 1)}>↻ Actualiser</button>
      </div>

      {error && (
        <div className="notice error" role="alert">
          <span>!</span>{error}
          <button onClick={() => setReloadKey((value) => value + 1)}>Réessayer</button>
        </div>
      )}

      {loading ? <div className="loading-card"><span className="spinner" />Chargement de votre espace…</div> : (
        <>
          <div className="teacher-profile-card surface">
            <div className="teacher-profile-avatar">{[profile?.firstName?.[0], profile?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "EN"}</div>
            <div className="teacher-profile-details">
              <span className="eyebrow">MON PROFIL</span>
              <h2>{[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Profil enseignant"}</h2>
              <p>{profile?.email || "Adresse e-mail non renseignée"}</p>
            </div>
            <div className="teacher-profile-meta">
              <span><small>Grade</small><strong>{profile?.grade || "Non renseigné"}</strong></span>
              <span><small>Département</small><strong>{profile?.department || "Non renseigné"}</strong></span>
              <span className={`status-pill ${profile?.active === false ? "inactive" : "active"}`}>
                {profile?.active === false ? "Inactif" : "Actif"}
              </span>
            </div>
          </div>

          <div className="teacher-stat-grid">
            <article className="teacher-stat surface"><span className="teacher-stat-icon">↗</span><small>Affectations</small><strong>{summary.assignmentCount ?? assignments.length}</strong><span>Enseignements attribués</span></article>
            <article className="teacher-stat surface"><span className="teacher-stat-icon warm">◷</span><small>Volume horaire</small><strong>{Number(summary.totalTeachingHours || 0).toLocaleString("fr-FR")} h</strong><span>Total des heures affectées</span></article>
          </div>

          <section className="surface teacher-assignment-panel">
            <div className="surface-heading">
              <div><div className="eyebrow">MON PROGRAMME</div><h2>Matières qui me sont affectées</h2><p>Informations de l’année et du semestre pour chaque affectation.</p></div>
            </div>
            {assignments.length === 0 ? (
              <div className="empty-state"><span className="empty-mark">◌</span><h3>Aucune affectation pour le moment</h3><p>Vos affectations apparaîtront ici quand elles auront été créées par l’équipe pédagogique.</p></div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead><tr><th>MATIÈRE</th><th>CODE</th><th>FORMATION</th><th>SEMESTRE</th><th>ANNÉE</th><th>VOLUME HORAIRE</th></tr></thead>
                  <tbody>{assignments.map((item) => (
                    <tr key={item.id}>
                      <td><strong className="table-primary">{item.subject || "—"}</strong></td>
                      <td>{item.code || "—"}</td>
                      <td>{item.formation || "—"}</td>
                      <td><span className="recent-term">{item.semester || "—"}</span></td>
                      <td>{item.academicYear || "—"}</td>
                      <td><strong className="hours-value">{item.teachingHours} h</strong></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function rowSearchText(page, row) {
  if (page === "teachers") {
    return `${row.firstName} ${row.lastName} ${row.email} ${row.grade} ${row.department?.name}`;
  }
  if (page === "subjects") {
    return `${row.name} ${row.code} ${row.description} ${row.formation?.name}`;
  }
  if (page === "assignments") {
    return `${displayName(row.teacher)} ${row.subject?.name} ${row.subject?.code} ${row.semester} ${row.academicYear}`;
  }
  return `${row.name} ${row.description}`;
}

function Dashboard({ data, loading, totalHours, onNavigate }) {
  const recentAssignments = [...data.assignments].slice(-5).reverse();

  return (
    <section className="dashboard">
      <div className="hero">
        <div className="hero-text">
          <div className="eyebrow light">PILOTAGE DE L’ÉTABLISSEMENT</div>
          <h1>La gestion pédagogique,<br />en toute clarté.</h1>
          <p>
            Un espace central pour organiser les équipes, les matières et les
            enseignements de l’année.
          </p>
          <button
            className="hero-button"
            onClick={() => onNavigate("assignments")}
          >
            Explorer les affectations <span>→</span>
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-core">S</div>
          <span className="art-star star-one">✳</span>
          <span className="art-star star-two">·</span>
          <span className="art-label">SAVOIR<br />&amp; TRANSMISSION</span>
        </div>
        <div className="hero-index">01 <span>/ 04</span></div>
      </div>

      <div className="section-title-row">
        <div>
          <div className="eyebrow">LES INDICATEURS</div>
          <h2>Votre établissement en chiffres</h2>
        </div>
        <span className="live-label"><span /> Données en direct</span>
      </div>

      {loading ? (
        <div className="loading-card"><span className="spinner" />Chargement des indicateurs…</div>
      ) : (
        <div className="metric-grid">
          <MetricCard
            label="Enseignants"
            value={data.teachers.length}
            detail="Profils enregistrés"
            symbol="♙"
            color="blue"
            onClick={() => onNavigate("teachers")}
          />
          <MetricCard
            label="Matières"
            value={data.subjects.length}
            detail="Dans le catalogue"
            symbol="▤"
            color="green"
            onClick={() => onNavigate("subjects")}
          />
          <MetricCard
            label="Affectations"
            value={data.assignments.length}
            detail="Pour l’année en cours"
            symbol="↗"
            color="ochre"
            onClick={() => onNavigate("assignments")}
          />
          <MetricCard
            label="Heures planifiées"
            value={`${totalHours.toLocaleString("fr-FR")} h`}
            detail="Volume cumulé"
            symbol="◷"
            color="lilac"
            onClick={() => onNavigate("assignments")}
          />
        </div>
      )}

      <div className="dashboard-lower">
        <section className="surface recent-surface">
          <div className="surface-heading">
            <div>
              <div className="eyebrow">SUIVI PÉDAGOGIQUE</div>
              <h2>Affectations récentes</h2>
              <p>Informations récupérées depuis votre backend.</p>
            </div>
            <button className="link-button" onClick={() => onNavigate("assignments")}>
              Tout voir <span>→</span>
            </button>
          </div>

          {loading ? (
            <div className="table-loading"><span className="spinner" />Chargement…</div>
          ) : recentAssignments.length === 0 ? (
            <EmptyState
              title="Aucune affectation pour le moment"
              text="Créez une affectation pour la voir apparaître ici."
              action="Créer une affectation"
              onClick={() => onNavigate("assignments")}
            />
          ) : (
            <div className="recent-list">
              {recentAssignments.map((assignment) => (
                <div className="recent-row" key={assignment.id}>
                  <span className="recent-monogram">
                    {displayName(assignment.teacher)
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="recent-person">
                    <strong>{displayName(assignment.teacher)}</strong>
                    <small>{assignment.teacher?.department?.name || "Département non renseigné"}</small>
                  </span>
                  <span className="recent-subject">
                    <strong>{assignment.subject?.name || "Matière"}</strong>
                    <small>{assignment.subject?.code || "—"}</small>
                  </span>
                  <span className="recent-term">{assignment.semester}</span>
                  <strong className="recent-hours">{assignment.teachingHours} h</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="surface shortcuts-surface">
          <div className="eyebrow">ACCÈS RAPIDE</div>
          <h2>Continuer votre travail</h2>
          <p className="shortcuts-intro">Accédez directement aux espaces de gestion.</p>
          <button className="shortcut" onClick={() => onNavigate("teachers")}>
            <span className="shortcut-icon">＋</span>
            <span><strong>Enseignants</strong><small>Consulter ou ajouter un profil</small></span>
            <span className="shortcut-arrow">↗</span>
          </button>
          <button className="shortcut" onClick={() => onNavigate("subjects")}>
            <span className="shortcut-icon warm">＋</span>
            <span><strong>Matières</strong><small>Gérer le catalogue pédagogique</small></span>
            <span className="shortcut-arrow">↗</span>
          </button>
          <button className="shortcut" onClick={() => onNavigate("formations")}>
            <span className="shortcut-icon cool">⌘</span>
            <span><strong>Formations</strong><small>Explorer les parcours proposés</small></span>
            <span className="shortcut-arrow">↗</span>
          </button>
        </aside>
      </div>
    </section>
  );
}

function MetricCard({ label, value, detail, symbol, color, onClick }) {
  return (
    <button className="metric-card" onClick={onClick}>
      <span className={`metric-symbol ${color}`}>{symbol}</span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
      <span className="metric-corner">↗</span>
    </button>
  );
}

function EntryForm({ page, values, data, saving, onChange, onSubmit, onCancel, title }) {
  const fields = {
    departments: [
      { name: "name", label: "Nom du département", required: true },
      { name: "description", label: "Description", type: "textarea" },
    ],
    formations: [
      { name: "name", label: "Nom de la formation", required: true },
      { name: "description", label: "Description", type: "textarea" },
    ],
    teachers: [
      { name: "firstName", label: "Prénom", required: true },
      { name: "lastName", label: "Nom", required: true },
      { name: "email", label: "Adresse e-mail", type: "email", required: true },
      { name: "grade", label: "Grade" },
      {
        name: "departmentId",
        label: "Département",
        type: "select",
        required: true,
        options: data.departments.map((item) => ({ value: item.id, label: item.name })),
      },
    ],
    subjects: [
      { name: "name", label: "Nom de la matière", required: true },
      { name: "code", label: "Code", required: true },
      { name: "description", label: "Description", type: "textarea" },
      {
        name: "formationId",
        label: "Formation",
        type: "select",
        required: true,
        options: data.formations.map((item) => ({ value: item.id, label: item.name })),
      },
    ],
    assignments: [
      {
        name: "teacherId",
        label: "Enseignant",
        type: "select",
        required: true,
        options: data.teachers.map((item) => ({
          value: item.id,
          label: displayName(item),
        })),
      },
      {
        name: "subjectId",
        label: "Matière",
        type: "select",
        required: true,
        options: data.subjects.map((item) => ({
          value: item.id,
          label: `${item.name} — ${item.code}`,
        })),
      },
      {
        name: "semester",
        label: "Semestre",
        type: "select",
        required: true,
        options: [
          { value: "S1", label: "Semestre 1" },
          { value: "S2", label: "Semestre 2" },
        ],
      },
      { name: "academicYear", label: "Année universitaire", required: true },
      {
        name: "teachingHours",
        label: "Volume horaire",
        type: "number",
        min: "0.01",
        step: "0.01",
        required: true,
      },
    ],
  }[page];

  const noOptions = fields.some(
    (field) => field.type === "select" && field.options?.length === 0,
  );

  return (
    <form className="entry-form" onSubmit={onSubmit}>
      <div className="form-heading">
        <div>
          <div className="eyebrow">{title ? "MODIFICATION" : "NOUVEL ENREGISTREMENT"}</div>
          <h2>{title || sectionInfo[page].action}</h2>
        </div>
        <button type="button" className="form-close" onClick={onCancel} aria-label="Fermer">
          ×
        </button>
      </div>

      {noOptions && (
        <div className="form-hint">
          Ajoute d’abord les éléments nécessaires dans leurs sections : un enseignant
          doit avoir un département, une matière une formation, et une affectation
          un enseignant et une matière.
        </div>
      )}

      <div className="form-grid">
        {fields.map((field) => (
          <label className={`form-field ${field.type === "textarea" ? "wide" : ""}`} key={field.name}>
            <span>{field.label}{field.required && <i> *</i>}</span>
            {field.type === "select" ? (
              <select
                required={field.required}
                value={values[field.name] ?? ""}
                onChange={(event) => onChange(field.name, event.target.value)}
              >
                <option value="">Sélectionner…</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                value={values[field.name] ?? ""}
                required={field.required}
                onChange={(event) => onChange(field.name, event.target.value)}
                rows="3"
              />
            ) : (
              <input
                type={field.type || "text"}
                min={field.min}
                step={field.step}
                required={field.required}
                value={values[field.name] ?? ""}
                onChange={(event) => onChange(field.name, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>

      <div className="form-actions">
        <span className="required-note">* Champ obligatoire</span>
        <button type="button" className="secondary-button" onClick={onCancel}>Annuler</button>
        <button type="submit" className="primary-button" disabled={saving || noOptions}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function DataTable({ page, rows, onCreate, canManage = false, canCreate = true, onEditTeacher, onToggleTeacherStatus, onEditSubject, onToggleSubjectStatus }) {
  const columns = {
    departments: [
      ["name", "Département"],
      ["description", "Description"],
    ],
    formations: [
      ["name", "Formation"],
      ["description", "Description"],
    ],
    teachers: [
      ["teacher", "Enseignant"],
      ["email", "E-mail"],
      ["grade", "Grade"],
      ["department", "Département"],
      ["status", "Statut"],
      ...(canManage ? [["actions", "Actions"]] : []),
    ],
    subjects: [
      ["subject", "Matière"],
      ["code", "Code"],
      ["formation", "Formation"],
      ["status", "Statut"],
      ...(canManage ? [["actions", "Actions"]] : []),
    ],
    assignments: [
      ["teacher", "Enseignant"],
      ["subject", "Matière"],
      ["period", "Période"],
      ["hours", "Volume horaire"],
    ],
  }[page];

  return (
    <div className="surface data-surface">
      {rows.length === 0 ? (
        <EmptyState
          title="Aucune donnée à afficher"
          text="La liste est vide ou aucun résultat ne correspond à votre recherche."
          action={canCreate ? "Ajouter un élément" : undefined}
          onClick={canCreate ? onCreate : undefined}
        />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map(([key]) => (
                    <td key={key}>
                      {key === "actions" && (page === "teachers" || page === "subjects") ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action edit"
                            onClick={() => page === "teachers" ? onEditTeacher?.(row) : onEditSubject?.(row)}
                          >Modifier</button>
                          <button
                            type="button"
                            className={`row-action ${row.isActive === false ? "activate" : "deactivate"}`}
                            onClick={() => page === "teachers" ? onToggleTeacherStatus?.(row) : onToggleSubjectStatus?.(row)}
                          >{row.isActive === false ? "Réactiver" : "Désactiver"}</button>
                        </div>
                      ) : renderCell(page, key, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function renderCell(page, key, row) {
  if (key === "teacher") {
    return <strong className="table-primary">{displayName(row)}</strong>;
  }
  if (key === "subject") {
    return (
      <span className="cell-stack">
        <strong className="table-primary">{row.subject?.name || row.name}</strong>
        <small>{row.subject?.code || row.code || ""}</small>
      </span>
    );
  }
  if (key === "department") return row.department?.name || "—";
  if (key === "formation") return row.formation?.name || "—";
  if (key === "status") {
    const active = row.isActive !== false;
    return <span className={`status-pill ${active ? "active" : "inactive"}`}>{active ? "Actif" : "Inactif"}</span>;
  }
  if (key === "period") return `${row.semester || "—"} · ${row.academicYear || "—"}`;
  if (key === "hours") return <strong className="hours-value">{row.teachingHours} h</strong>;
  return row[key] || "—";
}

function EmptyState({ title, text, action, onClick }) {
  return (
    <div className="empty-state">
      <span className="empty-mark">◌</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <button className="secondary-button" onClick={onClick}>{action}</button>}
    </div>
  );
}

export default App;
