import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  getCourseReviews,
  getMyCourseReview,
  upsertCourseReview,
} from "@/lib/course-social.functions";

export function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? "fill-indigo-500 text-indigo-500" : "text-indigo-200"}
        />
      ))}
    </span>
  );
}

export function CourseReviews({
  courseId,
  currentUserId,
}: {
  courseId: string;
  currentUserId: string | null;
}) {
  const queryClient = useQueryClient();
  const fetchReviews = useServerFn(getCourseReviews);
  const fetchMine = useServerFn(getMyCourseReview);
  const saveReview = useServerFn(upsertCourseReview);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");

  const { data } = useQuery({
    queryKey: ["course-reviews", courseId],
    queryFn: () => fetchReviews({ data: { courseId } }),
  });

  const { data: mine } = useQuery({
    queryKey: ["my-course-review", courseId],
    queryFn: () => fetchMine({ data: { courseId } }),
    enabled: Boolean(currentUserId),
  });

  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setText(mine.review_text ?? "");
    }
  }, [mine]);

  const save = useMutation({
    mutationFn: async () =>
      saveReview({ data: { courseId, rating, review_text: text || null } }),
    onSuccess: () => {
      toast.success("Review saved");
      queryClient.invalidateQueries({ queryKey: ["course-reviews", courseId] });
      queryClient.invalidateQueries({ queryKey: ["my-course-review", courseId] });
      queryClient.invalidateQueries({ queryKey: ["course-ratings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = data?.summary;
  const reviews = data?.reviews ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-indigo-100 bg-card p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-indigo-900">Student reviews</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-3xl font-bold text-indigo-900">
              {summary?.average?.toFixed(1) ?? "0.0"}
            </span>
            <div>
              <StarRow value={summary?.average ?? 0} size={16} />
              <p className="text-xs text-muted-foreground">{summary?.count ?? 0} reviews</p>
            </div>
          </div>
        </div>
        <div className="w-full max-w-56 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary?.breakdown?.[star] ?? 0;
            const pct = summary?.count ? (count / summary.count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-3">{star}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-indigo-50">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${pct}%` }}
                    viewport={{ once: true }}
                    className="h-full rounded-full bg-indigo-500"
                  />
                </div>
                <span className="w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {currentUserId && (
        <div className="mt-5 rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-indigo-900">
            {mine ? "Update your review" : "Rate this course"}
          </p>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(i)}
                aria-label={`Rate ${i} stars`}
              >
                <Star
                  className={`size-6 ${
                    i <= (hover || rating)
                      ? "fill-indigo-500 text-indigo-500"
                      : "text-indigo-200"
                  }`}
                />
              </motion.button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="What did you think of this course?"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            disabled={!rating || save.isPending}
            onClick={() => save.mutate()}
            className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-indigo-700 disabled:opacity-50"
          >
            {mine ? "Update review" : "Submit review"}
          </motion.button>
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {reviews.map((r) => (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-indigo-900">
                {r.author_name ?? "Space learner"}
              </span>
              <StarRow value={r.rating} />
              <span className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </span>
            </div>
            {r.review_text && (
              <p className="mt-1 text-sm text-foreground/90">{r.review_text}</p>
            )}
          </motion.li>
        ))}
      </ul>
      {reviews.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No reviews yet.</p>
      )}
    </motion.div>
  );
}
