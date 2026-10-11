import { parseMedia } from "@remotion/media-parser";
import type { CalculateMetadataFunction } from "remotion";
import { editSchema, type Clip, type EditProps } from "./schema";
import { resolveSrc } from "./utils";

const getClipDuration = async (clip: Clip): Promise<number> => {
  let end = clip.endAt;
  if (end === null) {
    const { durationInSeconds } = await parseMedia({
      src: resolveSrc(clip.src),
      fields: { durationInSeconds: true },
      acknowledgeRemotionLicense: true,
    });
    if (durationInSeconds === null) {
      throw new Error(
        `Impossibile leggere la durata di "${clip.src}": specifica "endAt".`,
      );
    }
    end = durationInSeconds;
  }
  const trimmed = end - clip.startFrom;
  if (trimmed <= 0) {
    throw new Error(`La clip "${clip.src}" ha endAt <= startFrom.`);
  }
  return trimmed / clip.playbackRate;
};

export const calculateEditMetadata: CalculateMetadataFunction<
  EditProps
> = async ({ props: inputProps }) => {
  // Applica i valori di default dello schema: un JSON passato con --props
  // può contenere solo i campi che vuoi cambiare
  const props = editSchema.parse(inputProps);
  const resolvedClipDurations = await Promise.all(
    props.clips.map(getClipDuration),
  );

  const { fps } = props;
  const segments = [
    ...(props.title ? [props.title.durationInSeconds] : []),
    ...resolvedClipDurations,
    ...(props.outro ? [props.outro.durationInSeconds] : []),
  ].map((s) => Math.round(s * fps));

  const transitionFrames = getTransitionFrames(props, segments);
  const total =
    segments.reduce((a, b) => a + b, 0) -
    transitionFrames * (segments.length - 1);

  return {
    durationInFrames: Math.max(1, total),
    fps,
    width: props.width,
    height: props.height,
    props: { ...props, resolvedClipDurations },
  };
};

// Una transizione non può durare più del segmento più corto che collega
export const getTransitionFrames = (
  props: EditProps,
  segmentFrames: number[],
): number => {
  if (props.transition.type === "none" || segmentFrames.length < 2) {
    return 0;
  }
  const wanted = Math.round(props.transition.durationInSeconds * props.fps);
  return Math.max(0, Math.min(wanted, Math.min(...segmentFrames) - 1));
};
