# 纯标准库 PNG 解码 / 缩放 / ICO 生成（本机无 ImageMagick、无 Pillow）
import zlib, struct

def decode_png(path):
    d=open(path,'rb').read()
    assert d[:8]==b'\x89PNG\r\n\x1a\n'
    i=8; idat=b''; pal=None; trns=None
    while i<len(d):
        ln=struct.unpack('>I',d[i:i+4])[0]; typ=d[i+4:i+8]; body=d[i+8:i+8+ln]; i+=12+ln
        if typ==b'IHDR':
            w,h,bd,ct,comp,filt,inter=struct.unpack('>IIBBBBB',body)
            assert bd==8, f'only 8-bit supported, got {bd}'
            assert inter==0, 'interlaced not supported'
        elif typ==b'PLTE': pal=body
        elif typ==b'tRNS': trns=body
        elif typ==b'IDAT': idat+=body
        elif typ==b'IEND': break
    raw=zlib.decompress(idat)
    nch={0:1,2:3,3:1,4:2,6:4}[ct]
    stride=w*nch
    out=bytearray(); prev=bytearray(stride); pos=0
    for _ in range(h):
        f=raw[pos]; pos+=1
        line=bytearray(raw[pos:pos+stride]); pos+=stride
        if f==1:
            for x in range(nch,stride): line[x]=(line[x]+line[x-nch])&255
        elif f==2:
            for x in range(stride): line[x]=(line[x]+prev[x])&255
        elif f==3:
            for x in range(stride):
                a=line[x-nch] if x>=nch else 0
                line[x]=(line[x]+((a+prev[x])>>1))&255
        elif f==4:
            for x in range(stride):
                a=line[x-nch] if x>=nch else 0
                b=prev[x]; c=prev[x-nch] if x>=nch else 0
                p=a+b-c; pa=abs(p-a); pb=abs(p-b); pc=abs(p-c)
                pr=a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        out+=line; prev=line
    # 统一转 RGBA
    px=bytearray(w*h*4)
    for n in range(w*h):
        s=n*nch
        if ct==6:   px[n*4:n*4+4]=out[s:s+4]
        elif ct==2: px[n*4:n*4+3]=out[s:s+3]; px[n*4+3]=255
        elif ct==0: v=out[s]; px[n*4:n*4+3]=bytes([v,v,v]); px[n*4+3]=255
        elif ct==4: v=out[s]; px[n*4:n*4+3]=bytes([v,v,v]); px[n*4+3]=out[s+1]
        elif ct==3:
            k=out[s]; px[n*4:n*4+3]=pal[k*3:k*3+3]
            px[n*4+3]=(trns[k] if trns and k<len(trns) else 255)
    return w,h,px

def alpha_stats(w,h,px):
    amin,amax=255,0; bbox=[w,h,0,0]; nz=0
    for y in range(h):
        for x in range(w):
            a=px[(y*w+x)*4+3]
            amin=min(amin,a); amax=max(amax,a)
            if a>8:
                nz+=1
                bbox[0]=min(bbox[0],x); bbox[1]=min(bbox[1],y)
                bbox[2]=max(bbox[2],x); bbox[3]=max(bbox[3],y)
    return amin,amax,nz,bbox

def crop_pad_square(w,h,px,bbox,pad_ratio=0.04):
    x0,y0,x1,y1=bbox
    cw,ch=x1-x0+1,y1-y0+1
    side=max(cw,ch)
    side=int(round(side*(1+2*pad_ratio)))
    canvas=bytearray(side*side*4)          # 全透明底
    ox=(side-cw)//2; oy=(side-ch)//2
    for y in range(ch):
        sy=y0+y
        row=px[(sy*w+x0)*4:(sy*w+x0+cw)*4]
        canvas[((oy+y)*side+ox)*4:((oy+y)*side+ox+cw)*4]=row
    return side,canvas

def resize_area(sw,sh,spx,tw,th):
    # 面积平均（先乘 alpha 预乘，避免透明边缘发黑），源为正方形母版
    out=bytearray(tw*th*4)
    for ty in range(th):
        y0=ty*sh//th; y1=max(y0+1,(ty+1)*sh//th)
        for tx in range(tw):
            x0=tx*sw//tw; x1=max(x0+1,(tx+1)*sw//tw)
            r=g=b=a=n=0
            for y in range(y0,y1):
                base=y*sw
                for x in range(x0,x1):
                    i=(base+x)*4; al=spx[i+3]
                    r+=spx[i]*al; g+=spx[i+1]*al; b+=spx[i+2]*al; a+=al; n+=1
            o=(ty*tw+tx)*4
            if a==0:
                out[o:o+4]=b'\x00\x00\x00\x00'
            else:
                out[o]=min(255,round(r/a)); out[o+1]=min(255,round(g/a)); out[o+2]=min(255,round(b/a))
                out[o+3]=round(a/n)
    return out

def write_ico(entries,path):
    # entries: [(size, rgba)]  —— 每张以 32bpp BMP(DIB) 存，兼容性最好
    n=len(entries); blobs=[]
    for size,px in entries:
        hdr=struct.pack('<IiiHHIIiiII',40,size,size*2,1,32,0,size*size*4,0,0,0,0)
        rows=bytearray()
        for y in range(size-1,-1,-1):                      # DIB 自下而上
            for x in range(size):
                i=(y*size+x)*4
                rows+=bytes([px[i+2],px[i+1],px[i],px[i+3]])
        mask_row=((size+31)//32)*4
        rows+=b'\x00'*(mask_row*size)                       # AND 掩码全 0（用 alpha 通道）
        blobs.append(hdr+bytes(rows))
    off=6+16*n; out=struct.pack('<HHH',0,1,n)
    for (size,_),blob in zip(entries,blobs):
        out+=struct.pack('<BBBBHHII',size%256,size%256,0,0,1,32,len(blob),off); off+=len(blob)
    for blob in blobs: out+=blob
    open(path,'wb').write(out)
    return len(out)
