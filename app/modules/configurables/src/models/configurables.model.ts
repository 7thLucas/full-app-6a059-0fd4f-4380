import {
  prop,
  getModelForClass,
  modelOptions,
  Severity,
} from "@typegoose/typegoose";
import { CommonTypegooseEntity } from "~/api/models/base/common-typegoose.entity";

@modelOptions({
  schemaOptions: {
    collection: "tbl_app_configurables",
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  options: {
    allowMixed: Severity.ALLOW,
  },
})
export class Configurable extends CommonTypegooseEntity {
  @prop({ type: Boolean, default: true })
  _singleton!: boolean;

  @prop({ type: Object, default: {} })
  configurable_data!: any;
}

export const ConfigurableModel = getModelForClass(Configurable);
