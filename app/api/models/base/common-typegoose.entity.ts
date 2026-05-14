import { prop, modelOptions } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";

@modelOptions({
  schemaOptions: {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  },
})
export abstract class CommonTypegooseEntity extends TimeStamps {
  @prop({ type: Date, required: false })
  deletedAt?: Date | null;
}
