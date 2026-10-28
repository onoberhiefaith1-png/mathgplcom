/**
 * Community profile editor — lives in the WORKSPACE, not in Community.
 *
 * Community only ever displays what is set here. Listing is opt-in, students
 * never expose location, and text passes AI screening before it goes public.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router-compat";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import {
  profileCompleteness,
  saveMyCommunityProfile,
  type CommunityRoleKind,
  type ProfessionalDetails,
  type SaveCommunityProfileInput,
} from "@/lib/community/people";
import { useMyCommunityProfile } from "@/lib/community/usePeople";
import { screenCommunityText } from "@/lib/community/moderation.functions";
import MediaUploadField from "@/components/community/MediaUploadField";


const listToText = (values?: string[]) => (values ?? []).join(", ");
const textToList = (value: string) =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

type ProField = { key: keyof ProfessionalDetails; label: string; hint: string; list: boolean };

const SHARED_FIELDS: ProField[] = [
  { key: "languages", label: "Languages", hint: "English, French", list: true },
  { key: "links", label: "Links", hint: "https://…, https://…", list: true },
];

const PRO_FIELDS: Record<CommunityRoleKind, ProField[]> = {
  teacher: [
    { key: "subjects", label: "Subjects", hint: "Mathematics, Further Mathematics", list: true },
    { key: "levels", label: "Levels taught", hint: "KS3, GCSE, A-Level", list: true },
    { key: "ageGroups", label: "Age groups", hint: "11-14, 14-16", list: true },
    { key: "curricula", label: "Curricula", hint: "National Curriculum, IB", list: true },
    { key: "degrees", label: "Degrees", hint: "BSc Mathematics — University of Leeds", list: true },
    { key: "institutions", label: "Institutions attended", hint: "University of Leeds", list: true },
    { key: "qualifications", label: "Qualifications", hint: "PGCE, QTS", list: true },
    { key: "certifications", label: "Certifications", hint: "Examiner training", list: true },
    { key: "currentRole", label: "Current role", hint: "Head of Mathematics", list: false },
    { key: "experience", label: "Teaching experience", hint: "Head of Maths — Oak Academy (2019-2024)", list: true },
    { key: "previousRoles", label: "Previous roles", hint: "Maths teacher — Oak Academy", list: true },
    { key: "skills", label: "Skills", hint: "Exam preparation, intervention", list: true },
    { key: "expertise", label: "Areas of expertise", hint: "Algebra, geometry", list: true },
    { key: "achievements", label: "Achievements", hint: "Regional teaching award 2024", list: true },
    { key: "onlineAvailability", label: "Online teaching availability", hint: "Evenings and weekends", list: false },
    ...SHARED_FIELDS,
  ],
  school: [
    { key: "schoolType", label: "School type", hint: "Secondary, independent", list: false },
    { key: "subjects", label: "Subjects offered", hint: "Mathematics, Sciences", list: true },
    { key: "levels", label: "Levels", hint: "JSS, SSS", list: true },
    { key: "ageRange", label: "Age range", hint: "11-18", list: false },
    { key: "studentCount", label: "Number of students", hint: "About 900", list: false },
    { key: "programmes", label: "Programmes", hint: "STEM enrichment, exam clinic", list: true },
    { key: "approach", label: "Teaching approach", hint: "Mastery with weekly intervention", list: false },
    { key: "staff", label: "Mathematics staff", hint: "Head of Maths, 6 teachers", list: true },
    { key: "opportunities", label: "Opportunities", hint: "Hiring a KS4 maths teacher", list: true },
    { key: "website", label: "Website", hint: "https://…", list: false },
    { key: "achievements", label: "Achievements", hint: "Top 10 regional results 2025", list: true },
    ...SHARED_FIELDS,
  ],
  student: [
    { key: "yearGroup", label: "Year group", hint: "Year 9", list: false },
    { key: "levels", label: "Level", hint: "KS3", list: true },
    { key: "subjects", label: "Subjects", hint: "Mathematics", list: true },
    { key: "interests", label: "Learning interests", hint: "Algebra, problem solving", list: true },
    { key: "goals", label: "Learning goals", hint: "Grade 8 at GCSE", list: true },
    { key: "achievements", label: "Achievements", hint: "Maths challenge finalist", list: true },
  ],
  parent: [
    { key: "interests", label: "Educational interests", hint: "Primary mathematics, tutoring", list: true },
    { key: "levels", label: "Levels of interest", hint: "KS2, KS3", list: true },
    { key: "goals", label: "What I am looking for", hint: "A GCSE maths tutor", list: true },
    ...SHARED_FIELDS,
  ],
};


const ROLES: { kind: CommunityRoleKind; label: string }[] = [
  { kind: "teacher", label: "Teacher" },
  { kind: "school", label: "School" },
  { kind: "student", label: "Student" },
  { kind: "parent", label: "Parent" },
];

const Field = ({
  label,
  hint,
  value,
  onChange,
  textarea,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
  type?: string;
}) => (
  <label className="block">
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    {textarea ? (
      <textarea
        value={value}
        rows={5}
        onChange={(event) => onChange(event.target.value)}
        placeholder={hint}
        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    ) : (
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={hint}
        className="mt-1.5 min-h-[42px] w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />
    )}
  </label>
);

const CommunityProfileEditorPage = () => {
  const { data, isLoading } = useMyCommunityProfile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SaveCommunityProfileInput | null>(null);

  useEffect(() => {
    if (data && !form) {
      const { userId: _userId, moderationState: _s, moderationReason: _r, ...editable } = data;
      setForm(editable);
    }
  }, [data, form]);

  const completeness = useMemo(() => (form ? profileCompleteness(form) : 0), [form]);
  const role = form?.roleKind ?? "teacher";
  const isStudent = role === "student";

  const patch = (next: Partial<SaveCommunityProfileInput>) =>
    setForm((prev) => (prev ? { ...prev, ...next } : prev));
  const patchPro = (next: Partial<ProfessionalDetails>) =>
    setForm((prev) => (prev ? { ...prev, professional: { ...prev.professional, ...next } } : prev));

  const save = useMutation({
    mutationFn: async (input: SaveCommunityProfileInput) => {
      // Students never publish a location, whatever is typed.
      const cleaned: SaveCommunityProfileInput = isStudent ? { ...input, location: "", country: "" } : input;

      let moderation: { state: "approved" | "rejected" | "pending"; reason: string | null } = {
        state: "approved",
        reason: null,
      };

      if (cleaned.isListed) {
        const fields = [
          { label: "Name", value: cleaned.displayName },
          { label: "Headline", value: cleaned.headline },
          { label: "Short bio", value: cleaned.bio },
          { label: "About", value: cleaned.bioLong },
        ].filter((field) => field.value.trim().length > 0);
        if (fields.length > 0) {
          const verdict = await screenCommunityText({ data: { fields } });
          moderation = verdict.ok
            ? { state: "approved", reason: null }
            : { state: "rejected", reason: verdict.reason ?? "Content did not pass safety screening." };
        }
      }


      await saveMyCommunityProfile(cleaned, moderation);
      return moderation;
    },
    onSuccess: (moderation) => {
      void queryClient.invalidateQueries({ queryKey: ["community"] });
      if (moderation.state === "rejected") {
        toast.error(moderation.reason ?? "Profile saved but not listed.");
      } else {
        toast.success("Community profile saved.");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save your profile."),
  });

  if (isLoading || !form) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> My workspace
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Community profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This is the profile other people see in Community. Nothing is public until you switch listing on.
      </p>

      {data?.moderationState === "rejected" && data.moderationReason && (
        <p className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {data.moderationReason}
        </p>
      )}

      <div className="mt-6 space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-card-foreground">List me in Community</p>
              <p className="text-sm text-muted-foreground">
                {isStudent
                  ? "Students appear with a name and interests only — never a location."
                  : "Appear in Community search and directories."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isListed}
              onClick={() => patch({ isListed: !form.isListed })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                form.isListed ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-background transition ${
                  form.isListed ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${completeness}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{completeness}% complete — none of it is required.</p>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Basics</h2>

          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              I am listed as
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {ROLES.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => patch({ roleKind: kind })}
                  className={`min-h-[38px] rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    form.roleKind === kind
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Public name" value={form.displayName} onChange={(v) => patch({ displayName: v })} />
          <Field
            label="Headline"
            hint="Mathematics teacher · GCSE and A-Level"
            value={form.headline}
            onChange={(v) => patch({ headline: v })}
          />
          <MediaUploadField
            label="Profile photo"
            hint="A clear photo of you — people trust a face."
            kind="photo"
            shape="round"
            accept="image/*"
            maxMb={5}
            value={form.avatarUrl}
            onUploaded={(path) => patch({ avatarUrl: path })}
            onCleared={() => patch({ avatarUrl: "" })}
          />
          <MediaUploadField
            label="Cover image or video"
            hint="The banner at the top of your profile. Upload a picture or a video."
            kind="cover"
            shape="banner"
            accept="image/*,video/*"
            maxMb={200}
            value={form.coverUrl}
            isVideo={form.coverKind === "video"}
            onUploaded={(path, file) =>
              patch({ coverUrl: path, coverKind: file.type.startsWith("video/") ? "video" : "image" })
            }
            onCleared={() => patch({ coverUrl: "", coverKind: "image" })}
          />
          <MediaUploadField
            label="Introduction video"
            hint="A short video introducing yourself — optional."
            kind="intro"
            shape="video"
            accept="video/*"
            maxMb={200}
            value={form.introVideoUrl}
            onUploaded={(path) => patch({ introVideoUrl: path })}
            onCleared={() => patch({ introVideoUrl: "" })}
          />


          {!isStudent && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location" hint="Leeds" value={form.location} onChange={(v) => patch({ location: v })} />
              <Field
                label="Country"
                hint="United Kingdom"
                value={form.country}
                onChange={(v) => patch({ country: v })}
              />
            </div>
          )}
          {role !== "student" && (
            <Field
              label="Years of experience"
              type="number"
              value={form.yearsExperience == null ? "" : String(form.yearsExperience)}
              onChange={(v) => patch({ yearsExperience: v.trim() === "" ? null : Number(v) })}
            />
          )}
          <Field
            label="Short bio"
            hint="One or two lines shown on search cards"
            value={form.bio}
            onChange={(v) => patch({ bio: v })}
            textarea
          />
          <Field
            label="Full about section"
            hint="Shown on your full profile only"
            value={form.bioLong}
            onChange={(v) => patch({ bioLong: v })}
            textarea
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Education and professional detail
          </h2>
          <p className="text-xs text-muted-foreground">Separate multiple entries with commas.</p>

          {PRO_FIELDS[role].map(({ key, label, hint, list }) => (
            <Field
              key={key as string}
              label={label}
              hint={hint}
              value={
                list
                  ? listToText(form.professional[key] as string[] | undefined)
                  : ((form.professional[key] as string | undefined) ?? "")
              }
              onChange={(value) =>
                patchPro({ [key]: list ? textToList(value) : value } as Partial<ProfessionalDetails>)
              }
            />
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(form)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {save.isPending ? "Checking and saving…" : "Save profile"}
          </button>
          {form.username && (
            <Link
              to={`/community/people/${form.username}`}
              className="text-sm font-semibold text-primary"
            >
              View my public profile
            </Link>
          )}
        </div>
      </div>
    </main>
  );
};

export default CommunityProfileEditorPage;
