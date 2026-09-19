"""Read the authors' small MATLAB level-5 parameter file without scipy.

This parser extracts data only; it does not implement the published neural model.
"""
import json
import math
import struct
import zlib
from pathlib import Path


def elements(buf):
    offset = 0
    while offset + 8 <= len(buf):
        tag, size = struct.unpack_from('<II', buf, offset)
        if tag >> 16:
            kind, size = tag & 0xffff, tag >> 16
            yield kind, buf[offset + 4:offset + 4 + size]
            offset += 8
        else:
            yield tag, buf[offset + 8:offset + 8 + size]
            # MATLAB's miCOMPRESSED elements are not padded.
            offset += 8 + (size if tag == 15 else (size + 7) // 8 * 8)


def matrix(buf):
    entries = list(elements(buf))
    kind = struct.unpack_from('<I', entries[0][1])[0] & 0xff
    dims = list(struct.unpack('<' + 'i' * (len(entries[1][1]) // 4), entries[1][1]))
    name = entries[2][1].decode('utf8')
    if kind == 1:
        values = [matrix(v)[1] for t, v in entries[3:] if t == 14]
    else:
        data_kind, data = entries[3]
        formats = {1: 'b', 2: 'B', 3: 'h', 4: 'H', 5: 'i', 6: 'I', 7: 'f', 9: 'd', 12: 'q', 13: 'Q'}
        fmt = formats[data_kind]
        values = list(struct.unpack('<' + fmt * (len(data) // struct.calcsize(fmt)), data))
    return name, {'shape': dims, 'columnMajor': values}


def read_file(path):
    result = {}
    for kind, buf in elements(path.read_bytes()[128:]):
        if kind == 15:
            kind, buf = next(elements(zlib.decompress(buf)))
        if kind == 14:
            name, value = matrix(buf)
            result[name] = value
    return result


if __name__ == '__main__':
    root = Path(__file__).parent
    data = read_file(root / 'data_and_parameters/Dx_steady_state_nonlinear_3_27-Mar-2023_3modules.mat')
    print({key: value['shape'] for key, value in data.items()})
    params = data['para_mu']['columnMajor']
    print('para_mu:', params)
    fitted = []
    start = 0
    for item in data['mat_lu_cell']['columnMajor']:
        rows, cols, _ = item['shape']
        size = rows * cols
        lo, hi = item['columnMajor'][:size], item['columnMajor'][size:]
        values = lo[:]
        for i in range(size):
            if lo[i] != hi[i]:
                values[i] = params[start]
                start += 1
        fitted.append([[values[r + rows*c] for c in range(cols)] for r in range(rows)])
    result = {'sourceCommit': '5d7c08a9a88f923169a0c3008aca68af421e9a7f', 'parameterFile': 'Dx_steady_state_nonlinear_3_27-Mar-2023_3modules.mat', 'parameterCells': fitted}
    (root / 'parameters-extracted.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
