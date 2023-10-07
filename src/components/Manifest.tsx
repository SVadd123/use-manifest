import React, { createContext, useRef, useCallback, useEffect, FC } from 'react'
import useManifest, { ManifestContext, Sort } from '../hooks/useManifest.js'
import useManifestState from '../hooks/useManifestState/index.js'
import DefaultTable from './DefaultTable/index.js'
import DefaultControls from './DefaultControls/index.js'
import Cell from './DefaultTable/DataCell'
import SimpleHeader from './DefaultHeader'

export interface Definition {
  id: string
  label?: React.ReactNode
  sortable?: boolean
  cellComponent?: typeof Cell
  headerComponent?: typeof SimpleHeader
}

export type CountFetcher<Filter> = (filter: Filter) => Promise<number>

export interface RowFetcherProps {
  page: number
  pageSize: number
  sorts: Sort[]
}

export type RowFetcher<Filter, Row> = (filter: Filter, props: RowFetcherProps) => Promise<Row[]>

export const manifestContext: React.Context<ManifestContext<any, any>> = createContext(null) as React.Context<any>

let rowCallId = 0
let countCallId = 0

function useCountFetcher<Filter> ({ fetchCount }: { fetchCount?: CountFetcher<Filter> }): (filter: Filter, props: RowFetcherProps) => Promise<void> {
  const { setLoadingCount, setCount, setError } = useManifest()
  if (fetchCount == null) {
    return async () => { }
  }
  return useCallback(
    async filter => {
      const id = ++countCallId
      setLoadingCount(true)
      try {
        const count = await fetchCount(filter)
        if (id !== countCallId) return
        setCount(count)
      } catch (error) {
        setError(error)
      }
      setLoadingCount(false)
    }
    , [setError, fetchCount, setLoadingCount, setCount])
}

function useRowFetcher<Filter, Row> ({ fetchRows }: { fetchRows: RowFetcher<Filter, Row> }): (filter: Filter, { page, pageSize, sorts }: RowFetcherProps) => Promise<void> {
  const { setLoadingRows, setRows, setError } = useManifest()
  return useCallback(
    async (filter, { page, pageSize, sorts }) => {
      const id = ++rowCallId
      setLoadingRows(true)
      try {
        const rows = await fetchRows(filter, { page, pageSize, sorts })
        if (id !== rowCallId) return
        setRows(rows)
      } catch (error) {
        setError(error)
      }
      setLoadingRows(false)
    }, [setError, fetchRows, setLoadingRows, setRows])
}

const useDetectChange = (value: any): boolean => {
  const ref = useRef()
  if (ref.current !== value) {
    ref.current = value
    return true
  }
  return false
}

export const useIsFirstLoad = (): boolean => {
  const ref = useRef<boolean>()
  if (ref.current === undefined || !ref.current) {
    ref.current = true
    return true
  }
  return false
}

export interface EffectsProps<Filter, Row> {
  fetchRows: RowFetcher<Filter, Row>
  fetchCount?: CountFetcher<Filter>
  autoLoad?: boolean
}

function Effects<Filter, Row> ({ fetchRows, fetchCount, autoLoad = false }: EffectsProps<Filter, Row>): null {
  const { page, pageSize, sorts, filter, count } = useManifest<Filter, Row>()
  const isFirstLoad = useIsFirstLoad()

  const runFetchCount = useCountFetcher<Filter>({ fetchCount })
  const runFetchRows = useRowFetcher<Filter, Row>({ fetchRows })

  const pageChanged = useDetectChange(page)
  const pageSizeChanged = useDetectChange(pageSize)
  const sortsChanged = useDetectChange(sorts)
  const filterChanged = useDetectChange(filter)

  useEffect(() => {
    if (isFirstLoad && !autoLoad) return

    if (pageChanged || pageSizeChanged || filterChanged || sortsChanged) {
      runFetchRows(filter, { page, pageSize, sorts }).catch(console.error)
    }
    if (filterChanged && count === null && (fetchCount != null)) {
      runFetchCount(filter, { page, pageSize, sorts }).catch(console.error)
    }
  })

  return null
}

const DefaultChildren: FC = () =>
  <>
    <DefaultTable />
    <DefaultControls />
  </>

export interface ManifestProps<Filter, Row> {
  children?: React.ReactNode | null
  fetchRows: RowFetcher<Filter, Row>
  fetchCount: CountFetcher<Filter>
  definition: Definition[]
  autoLoad?: boolean
}

function Manifest<Filter, Row> ({ children, fetchRows, fetchCount, definition, autoLoad }: ManifestProps<Filter, Row>): React.JSX.Element {
  const state = useManifestState()

  const contextValue = {
    ...state,
    fetchCount,
    definition
  }

  return (
    <manifestContext.Provider value={contextValue as any}>
      <Effects fetchCount={fetchCount} fetchRows={fetchRows} autoLoad={autoLoad} />
      {children ?? <DefaultChildren />}
    </manifestContext.Provider>
  )
}

export function ManifestBuilder<Filter, Row> (): {
  useManifest: () => ManifestContext<Filter, Row>
  Manifest: (props: ManifestProps<Filter, Row>) => React.JSX.Element
} {
  return {
    Manifest: Manifest<Filter, Row>,
    useManifest: useManifest<Filter, Row>
  }
}

export default Manifest
