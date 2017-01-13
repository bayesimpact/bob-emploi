FROM nginx:latest

RUN mkdir -p /usr/share/bob-emploi/html

ADD dist /usr/share/bob-emploi/html

ADD release/nginx.conf /etc/nginx/conf.d/default.conf
ADD release/entrypoint.sh /usr/share/bob-emploi/

CMD ["/usr/share/bob-emploi/entrypoint.sh"]

# Label the image with the git commit.
ARG GIT_SHA1=non-git
LABEL org.bayesimpact.git=$GIT_SHA1
