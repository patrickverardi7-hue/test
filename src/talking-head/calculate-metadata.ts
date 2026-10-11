import { parseMedia } from "@remotion/media-parser";
import type { CalculateMetadataFunction } from "remotion";
import { resolveSrc } from "../utils";
import { talkingHeadSchema, type TalkingHeadProps } from "./schema";

export const calculateTalkingHeadMetadata: CalculateMetadataFunction<
  TalkingHeadProps
> = async ({ props: inputProps }) => {
  const props = talkingHeadSchema.parse(inputProps);
  let end = props.trimEnd;
  if (end === null) {
    const { durationInSeconds } = await parseMedia({
      src: resolveSrc(props.src),
      fields: { durationInSeconds: true },
      acknowledgeRemotionLicense: true,
    });
    if (durationInSeconds === null) {
      throw new Error(`Impossibile leggere la durata di "${props.src}".`);
    }
    end = durationInSeconds;
  }
  const durationInSeconds = end - props.trimStart;
  return {
    durationInFrames: Math.max(1, Math.floor(durationInSeconds * props.fps)),
    fps: props.fps,
    width: props.width,
    height: props.height,
    props: { ...props, durationInSeconds },
  };
};
