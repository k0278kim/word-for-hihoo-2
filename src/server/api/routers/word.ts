import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

interface Word {
  id: string;
  word: string;
  meaning: string;
  createdAt: Date;
}

// 초기 데이터
let words: Word[] = [
  {
    id: "1",
    word: "Experience",
    meaning: "경험",
    createdAt: new Date(),
  },
];

export const wordRouter = createTRPCRouter({
  getAll: publicProcedure.query(() => {
    // 이제 인덱스 기반 관리를 위해 배열 순서 그대로 반환합니다.
    return [...words];
  }),

  create: publicProcedure
    .input(
      z.object({
        word: z.string().optional().default(""),
        meaning: z.string().optional().default(""),
        index: z.number().optional(), // 삽입할 위치
      })
    )
    .mutation(async ({ input }) => {
      const newWord: Word = {
        id: Math.random().toString(36).substring(2, 9),
        word: input.word,
        meaning: input.meaning,
        createdAt: new Date(),
      };

      if (typeof input.index === "number") {
        words.splice(input.index, 0, newWord);
      } else {
        words.push(newWord);
      }

      return newWord;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        word: z.string().optional(),
        meaning: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const index = words.findIndex((w) => w.id === input.id);
      if (index !== -1) {
        words[index] = {
          ...words[index]!,
          ...input,
        };
        return words[index];
      }
      return null;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      words = words.filter((w) => w.id !== input.id);
      return { success: true };
    }),

  deleteAll: publicProcedure.mutation(async () => {
    words = [];
    return { success: true };
  }),

  reorderAll: publicProcedure
    .input(z.array(z.object({
      id: z.string(),
      word: z.string(),
      meaning: z.string(),
      createdAt: z.date(),
    })))
    .mutation(async ({ input }) => {
      words = input;
      return { success: true };
    }),
});
