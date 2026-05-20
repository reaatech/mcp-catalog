import type { FastifyTypeProvider, FastifyPluginAsync, FastifyPluginOptions, RawServerBase, RawServerDefault } from 'fastify';
import type { ZodType } from 'zod';

export interface ZodV3TypeProvider extends FastifyTypeProvider {
  validator: this["schema"] extends ZodType ? this["schema"]["_output"] : unknown;
  serializer: this["schema"] extends ZodType ? this["schema"]["_input"] : unknown;
}

export type FastifyPluginAsyncZodV3<
  Options extends FastifyPluginOptions = Record<never, never>,
  Server extends RawServerBase = RawServerDefault,
> = FastifyPluginAsync<Options, Server, ZodV3TypeProvider>;

interface ZodSchemaDef {
  schema: ZodType;
  method: string;
  url: string;
  httpPart?: string;
  httpStatus?: string;
  contentType?: string;
}

type ValidationResult = {
  error?: Error;
  value?: unknown;
};

export function zValidatorCompiler({ schema }: ZodSchemaDef): (data: unknown) => ValidationResult {
  return (data: unknown) => {
    const result = (schema as ZodType).safeParse(data);
    if (result.success) {
      return { value: result.data };
    }
    const error = new Error('Validation failed');
    error.cause = result.error;
    return { error };
  };
}

export function zSerializerCompiler({ schema }: ZodSchemaDef): (data: unknown) => string {
  return (data: unknown) => {
    const result = (schema as ZodType).safeParse(data);
    if (result.success) {
      return JSON.stringify(result.data);
    }
    const error = new Error('Response serialization failed');
    error.cause = result.error;
    throw error;
  };
}
