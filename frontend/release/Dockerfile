FROM nginx:stable

RUN mkdir -p /usr/share/bob-emploi/html

ADD dist /usr/share/bob-emploi/html

ADD nginx.conf /etc/nginx/conf.d/default.conf
ADD entrypoint.sh /usr/share/bob-emploi/
ADD const_dist.json /usr/share/bob-emploi/dist.json

CMD ["/usr/share/bob-emploi/entrypoint.sh"]

# Label the image with the git commit.
ARG GIT_SHA1=non-git
LABEL org.bayesimpact.git=$GIT_SHA1

ARG CLIENT_VERSION
RUN echo $CLIENT_VERSION > /usr/share/bob-emploi/version
