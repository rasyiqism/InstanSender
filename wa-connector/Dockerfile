FROM golang:1.25-alpine AS builder

RUN apk add --no-cache build-base
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go r2.go ./
RUN CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/wa-connector .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S neowa \
    && adduser -S -G neowa neowa \
    && mkdir -p /data \
    && chown neowa:neowa /data

COPY --from=builder /out/wa-connector /usr/local/bin/wa-connector
USER neowa
EXPOSE 8080
CMD ["wa-connector"]
