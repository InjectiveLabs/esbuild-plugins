import builtins from 'builtin-modules'
import { OnResolveArgs, OnResolveResult, Plugin } from 'esbuild'
import fs from 'fs'
import path from 'path'
import resolve from 'resolve'
import { promisify } from 'util'

const NAME = require('../package.json').name
const debug = require('debug')(NAME)
const NAMESPACE = NAME

const resolveAsync = promisify(resolve)

interface Options {
    external?: (path: string) => boolean
    onUnresolved?: (e: Error) => OnResolveResult | undefined | null | void
}

export function NodeResolvePlugin({
    external,
    onUnresolved,
}: Options = {}): Plugin {
    const builtinsSet = new Set(builtins)

    return {
        name: NAME,
        setup: function setup({ onLoad, onResolve }) {
            onLoad({ filter: /.*/, namespace: NAMESPACE }, async (args) => {
                const contents = await (
                    await fs.promises.readFile(args.path)
                ).toString()
                let resolveDir = path.dirname(args.path)
                // console.log({ resolveDir })
                debug('onLoad')
                return {
                    loader: 'default',
                    contents,
                    resolveDir,
                    // errors: [{ text: resolveDir }],
                }
            })

            onResolve(
                { filter: /.*/ },
                async function resolver(args: OnResolveArgs) {
                    if (builtinsSet.has(args.path)) {
                        return null
                    }
                    let resolved
                    try {
                        resolved = await resolveAsync(args.path, {
                            basedir: args.resolveDir,
                            extensions: [
                                '.ts',
                                '.tsx',
                                '.mjs',
                                '.js',
                                '.jsx',
                                '.cjs',
                            ],
                        })
                    } catch (e) {
                        if (onUnresolved) {
                            debug(`not resolved ${args.path}`)
                            let res = onUnresolved(e)
                            return res || null
                        } else {
                            throw e
                        }
                    }
                    debug('resolved', resolved)
                    if (external && external(resolved)) {
                        debug('externalizing', external)
                        return {
                            external: true, // TODO maybe use the ESM external trick?
                        }
                    }

                    debug('onResolve')
                    return {
                        path: resolved,
                        namespace: NAMESPACE,
                    }
                },
            )
        },
    }
}

export default NodeResolvePlugin
